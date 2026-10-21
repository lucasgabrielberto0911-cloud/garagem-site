import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { scheduleAfterSale } from "../src/lib/after-sale";
import { expireReservations } from "../src/lib/reservations";

const db = new PrismaClient();
const vehicleId = "ce2eadminlote4vehicle";
const customerId = "ce2eadminlote4customer";

test.beforeAll(async () => {
  await db.sale.deleteMany({ where: { vehicleId } });
  await db.vehicle.deleteMany({ where: { id: vehicleId } });
  await db.customer.upsert({ where: { id: customerId }, create: { id: customerId, name: "Cliente Comercial E2E", phone: "27999990000" }, update: {} });
  await db.admin.upsert({ where: { email: "comercial@local.test" }, create: { name: "Teste local", email: "comercial@local.test", passwordHash: await bcrypt.hash("comercial-local-123", 4) }, update: {} });
  await db.vehicle.create({ data: { id: vehicleId, brand: "Honda", model: "Civic Comercial E2E", year: 2020, yearModel: 2020, km: 50000, price: 60000, purchasePrice: 50000, fuel: "Flex", transmission: "Automático", createdAt: new Date(Date.now() - 100 * 86400000) } });
});
test.afterAll(async () => {
  await db.sale.deleteMany({ where: { vehicleId } });
  await db.vehicle.deleteMany({ where: { id: vehicleId } });
  await db.customer.deleteMany({ where: { id: customerId } });
  await db.admin.deleteMany({ where: { email: "comercial@local.test" } });
  await db.$disconnect();
});

test("reserva, avaliação e fluxo único geram venda, contrato e recibo", async ({ page, request, context, baseURL, playwright }) => {
  test.setTimeout(120000);
  const publicRequest = await playwright.request.newContext({ baseURL });
  expect((await publicRequest.get("/api/admin/documentos/inexistente")).status()).toBe(401);
  const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
  expect(login.ok()).toBeTruthy();
  const cookie = login.headers()["set-cookie"].split(";")[0];
  await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);

  await page.goto(`/admin/veiculos/${vehicleId}?view=operacao`);
  const assessment = page.locator("details").filter({ has: page.locator("summary", { hasText: "Checklist de entrada" }) });
  await assessment.locator("summary").click();
  for (let index = 0; index < 14; index++) await assessment.locator(`select[name=item${index}]`).selectOption("ok");
  await assessment.locator("input[name=offer]").fill("50.000,00");
  await assessment.getByRole("checkbox").check();
  await assessment.getByRole("button", { name: "Salvar avaliação" }).click();
  await expect.poll(async () => (await db.vehicleAssessment.findUnique({ where: { vehicleId } }))?.approved).toBe(true);

  const reserve = page.locator("details").filter({ has: page.locator("summary", { hasText: "Reserva com sinal" }) });
  await reserve.locator("summary").click();
  await reserve.getByRole("combobox").click();
  await page.getByRole("option", { name: /Cliente Comercial E2E/ }).click();
  await reserve.locator("input[name=deposit]").fill("1.000,00");
  await reserve.locator("input[name=expiresAt]").fill("2099-01-01T10:00");
  await reserve.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect.poll(async () => (await db.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).status).toBe("reservado");

  await db.vehicleReservation.updateMany({ where: { vehicleId, status: "ativa" }, data: { createdAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1000) } });
  await expireReservations();
  expect((await db.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).status).toBe("disponivel");
  await db.vehicleReservation.create({ data: { vehicleId, customerId, deposit: 1000, expiresAt: new Date(Date.now() + 86400000) } });
  await db.vehicle.update({ where: { id: vehicleId }, data: { status: "reservado" } });

  await page.goto(`/admin/vendas/nova?veiculo=${vehicleId}`);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Cliente Comercial E2E · 27999990000")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Valor total negociado").fill("55.100,00");
  await page.getByRole("button", { name: /À vista\/PIX/ }).click();
  await page.getByLabel("Valor", { exact: true }).fill("54.100,00");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Responsável comercial").fill("Vendedor E2E");
  await page.getByLabel("Comissão (R$)").fill("0");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
  await expect(page.getByRole("heading", { name: "Venda registrada" })).toBeVisible();
  const sale = await db.sale.findUniqueOrThrow({ where: { vehicleId } });
  expect(sale.salePrice).toBe(55100);
  expect(sale.customerId).toBe(customerId);
  expect(sale.notes).toContain("Sinal recebido: R$ 1000.00 (incluído no total da venda).");
  expect(await db.afterSaleTask.count({ where: { saleId: sale.id } })).toBe(4);
  expect(await db.commercialDocument.count({ where: { vehicleId, kind: "contrato" } })).toBe(1);
  expect(await db.commercialDocument.count({ where: { vehicleId, kind: "recibo" } })).toBe(1);
  await db.$transaction(async (tx) => { await scheduleAfterSale(tx, sale); await scheduleAfterSale(tx, sale); });
  expect(await db.afterSaleTask.count({ where: { saleId: sale.id } })).toBe(4);
  const docs = await db.commercialDocument.findMany({ where: { vehicleId } });
  for (const doc of docs) {
    const pdf = await page.request.get(`/api/admin/documentos/${doc.id}`);
    expect(pdf.headers()["cache-control"]).toBe("private, no-store");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  }
  await publicRequest.dispose();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("atalho legado de vendas abre a página de fluxo", async ({ page, request, context, baseURL }) => {
  const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
  expect(login.ok()).toBeTruthy();
  const cookie = login.headers()["set-cookie"].split(";")[0];
  await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`/admin/vendas?vehicle=${vehicleId}`);
  await expect(page).toHaveURL(new RegExp(`/admin/vendas/nova\\?veiculo=${vehicleId}`));
  await expect(page.getByRole("heading", { name: "Iniciar venda" })).toBeVisible();
});

test.describe("fluxo único de venda", () => {
  const flowVehicleId = "ce2efluxounicovehicle";
  const duplicateCpfCustomerId = "ce2eduplicatecpf";
  test.beforeEach(async () => {
    await db.sale.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.commercialDocument.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.vehicleReservation.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.vehicle.deleteMany({ where: { id: flowVehicleId } });
    await db.customer.upsert({ where: { id: duplicateCpfCustomerId }, create: { id: duplicateCpfCustomerId, name: "CPF já cadastrado", phone: "27999990001", cpf: "52998224725" }, update: { cpf: "52998224725" } });
    await db.vehicle.create({ data: { id: flowVehicleId, brand: "Toyota", model: "Corolla Fluxo E2E", year: 2021, yearModel: 2021, km: 30000, price: 60000, fuel: "Flex", transmission: "Automático", chassis: "9BWZZZ377VT004251", renavam: "12345678901" } });
  });
  test.afterEach(async () => {
    await db.sale.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.commercialDocument.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.vehicleReservation.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.vehicle.deleteMany({ where: { id: flowVehicleId } });
    await db.customer.deleteMany({ where: { id: duplicateCpfCustomerId } });
  });

  test("inicia pela ficha e registra contrato pelo valor livre acima do anúncio", async ({ page, request, context, baseURL }) => {
    const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await page.goto(`/admin/veiculos/${flowVehicleId}`);
    await page.locator(`a[href="/admin/vendas/nova?veiculo=${flowVehicleId}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/admin/vendas/nova\\?veiculo=${flowVehicleId}`));
    await page.getByRole("button", { name: "Continuar" }).click();
    const customerSearch = page.getByRole("combobox");
    await customerSearch.click();
    await page.getByRole("option", { name: /Cliente Comercial E2E/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Valor total negociado").fill("67.000,00");
    await page.getByRole("button", { name: /À vista\/PIX/ }).click();
    await page.getByLabel("Valor", { exact: true }).fill("67.000,00");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Responsável comercial").fill("Vendedor E2E");
    await page.getByLabel("Comissão (R$)").fill("0");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
    await expect(page.getByRole("heading", { name: "Venda registrada" })).toBeVisible();
    const sale = await db.sale.findUniqueOrThrow({ where: { vehicleId: flowVehicleId } });
    expect(sale.salePrice).toBe(67000);
    expect(sale.customerId).toBe(customerId);
    expect((await db.vehicle.findUniqueOrThrow({ where: { id: flowVehicleId } })).price).toBe(60000);
    const contract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" } });
    expect((contract.snapshot as { total: number }).total).toBe(67000);
    expect(await db.commercialDocument.count({ where: { vehicleId: flowVehicleId, kind: "recibo" } })).toBe(0);
    const pdf = await page.request.get(`/api/admin/documentos/${contract.id}`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  });

  test("mantém cliente e RG ao iniciar pela lista e conclui veículo legado vendido", async ({ page, request, context, baseURL }) => {
    const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await db.customer.update({ where: { id: customerId }, data: { rg: "MG-12.345.678" } });
    await db.vehicle.update({ where: { id: flowVehicleId }, data: { status: "vendido" } });

    await page.goto("/admin/clientes");
    await page.locator(`a[href="/admin/vendas/nova?cliente=${customerId}"]`).click();
    await page.locator('input[placeholder="Buscar veículo"]').fill("Corolla Fluxo E2E");
    await page.getByRole("option", { name: /Corolla Fluxo E2E/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.locator('input[name="customer"]')).toHaveValue(customerId);
    await expect(page.getByLabel("RG")).toHaveValue("MG-12.345.678");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Valor total negociado").fill("67.000,00");
    await page.getByRole("button", { name: /À vista\/PIX/ }).click();
    await page.getByLabel("Valor", { exact: true }).fill("67.000,00");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Responsável comercial").fill("Vendedor E2E");
    await page.getByLabel("Comissão (R$)").fill("0");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
    await expect(page.getByRole("heading", { name: "Venda registrada" })).toBeVisible();
    expect((await db.sale.findUniqueOrThrow({ where: { vehicleId: flowVehicleId } })).customerId).toBe(customerId);
  });

  test("emite contrato para venda legada sem duplicar o registro", async ({ page, request, context, baseURL }) => {
    const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    const sale = await db.sale.create({ data: { vehicleId: flowVehicleId, customerId, salePrice: 67000, paymentMethod: "Pix" } });
    await db.vehicle.update({ where: { id: flowVehicleId }, data: { status: "vendido" } });

    await page.goto(`/admin/veiculos/${flowVehicleId}?view=operacao`);
    const documents = page.locator("details").filter({ has: page.locator("summary", { hasText: "Contratos e recibos gerados" }) });
    await documents.locator("summary").click();
    await documents.getByRole("combobox").click();
    await page.getByRole("option", { name: /Cliente Comercial E2E/ }).click();
    await documents.getByRole("button", { name: "Emitir contrato desta venda" }).click();
    await expect(documents.getByText(/Contrato nº/)).toBeVisible();
    expect(await db.sale.count({ where: { vehicleId: flowVehicleId } })).toBe(1);
    const contract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" } });
    expect((contract.snapshot as { saleId: string }).saleId).toBe(sale.id);
  });

  test("rejeita CPF duplicado ao cadastrar e atualizar cliente e limpa RG ao trocar para novo", async ({ page, request, context, baseURL }) => {
    const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await db.customer.update({ where: { id: customerId }, data: { rg: "MG-12.345.678", cpf: null } });

    for (const useNewCustomer of [false, true]) {
      await page.goto(`/admin/vendas/nova?veiculo=${flowVehicleId}`);
      await page.getByRole("button", { name: "Continuar" }).click();
      if (useNewCustomer) {
        await page.getByRole("combobox").click();
        await page.getByRole("option", { name: /Cliente Comercial E2E/ }).click();
        await expect(page.getByLabel("RG")).toHaveValue("MG-12.345.678");
        await page.getByLabel("Cadastrar cliente nesta venda").check();
        await expect(page.getByLabel("RG")).toHaveValue("");
        await page.getByLabel("Nome").fill("Novo comprador");
        await page.getByLabel("Telefone").fill("27988887777");
      } else {
        await page.getByRole("combobox").click();
        await page.getByRole("option", { name: /Cliente Comercial E2E/ }).click();
        await page.getByLabel("CPF").fill("529.982.247-25");
      }
      await page.getByLabel("CPF").fill("529.982.247-25");
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByLabel("Valor total negociado").fill("67.000,00");
      await page.getByRole("button", { name: /À vista\/PIX/ }).click();
      await page.getByLabel("Valor", { exact: true }).fill("67.000,00");
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByLabel("Responsável comercial").fill("Vendedor E2E");
      await page.getByLabel("Comissão (R$)").fill("0");
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
      await expect(page.getByRole("alert")).toHaveText("Já existe cliente com este telefone ou CPF; selecione o cadastro existente.");
    }
    expect(await db.sale.count({ where: { vehicleId: flowVehicleId } })).toBe(0);
  });
});
