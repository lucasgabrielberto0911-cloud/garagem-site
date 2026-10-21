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
  await db.vehicleReservation.deleteMany({ where: { vehicleId } });
  await db.vehicle.deleteMany({ where: { id: vehicleId } });
  await db.customer.deleteMany({ where: { id: "ce2eadminlote4outro" } });
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
  const heldReceipt = await db.commercialDocument.create({ data: { vehicleId, kind: "recibo", snapshot: { reservationId: (await db.vehicleReservation.findFirstOrThrow({ where: { vehicleId, status: "ativa" } })).id, amount: 1000, total: 60000, payment: "Sinal", payments: [{ method: "sinal", amount: 1000 }] } } });

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
  const receipt = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId, kind: "recibo" } });
  expect(receipt.id).toBe(heldReceipt.id);
  expect(receipt.snapshot).toMatchObject({ amount: 1000, total: 55100, payment: "Sinal", payments: [{ method: "sinal", amount: 1000 }] });
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
  const correctedCustomerId = "ce2efluxocorrigido";
  test.beforeEach(async () => {
    await db.sale.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.commercialDocument.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.vehicleReservation.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.vehicle.deleteMany({ where: { id: flowVehicleId } });
    await db.customer.upsert({ where: { id: duplicateCpfCustomerId }, create: { id: duplicateCpfCustomerId, name: "CPF já cadastrado", phone: "27999990001", cpf: "52998224725" }, update: { cpf: "52998224725" } });
    await db.customer.upsert({ where: { id: correctedCustomerId }, create: { id: correctedCustomerId, name: "Cliente antes E2E", phone: "27988887776" }, update: { name: "Cliente antes E2E", phone: "27988887776", address: null } });
    await db.vehicle.create({ data: { id: flowVehicleId, brand: "Toyota", model: "Corolla Fluxo E2E", year: 2021, yearModel: 2021, km: 30000, price: 60000, fuel: "Flex", transmission: "Automático", chassis: "9BWZZZ377VT004251", renavam: "12345678901" } });
  });
  test.afterEach(async () => {
    await db.sale.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.commercialDocument.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.vehicleReservation.deleteMany({ where: { vehicleId: flowVehicleId } });
    await db.vehicle.deleteMany({ where: { id: flowVehicleId } });
    await db.customer.deleteMany({ where: { id: duplicateCpfCustomerId } });
    await db.customer.deleteMany({ where: { id: correctedCustomerId } });
  });

  test("permite sinal posterior em reserva criada sem depósito", async ({ page, request, context, baseURL }) => {
    const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await db.vehicleReservation.create({ data: { vehicleId: flowVehicleId, customerId, deposit: 0, expiresAt: new Date(Date.now() + 86400000) } });
    await db.vehicle.update({ where: { id: flowVehicleId }, data: { status: "reservado" } });

    await page.goto(`/admin/vendas/nova?veiculo=${flowVehicleId}`);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Valor total negociado").fill("60.000,00");
    await page.getByRole("button", { name: "Houve sinal" }).click();
    await page.getByLabel("Valor do sinal").fill("5.000,00");
    await page.getByRole("button", { name: /À vista\/PIX/ }).click();
    await page.getByLabel("Valor", { exact: true }).fill("55.000,00");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Responsável comercial").fill("Vendedor E2E");
    await page.getByLabel("Comissão (R$)").fill("0");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
    await expect(page.getByRole("heading", { name: "Venda registrada" })).toBeVisible();
    const contract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" } });
    const snapshot = contract.snapshot as { signal?: { amount: number }; payments: { method: string; amount: number }[] };
    expect(snapshot.signal?.amount).toBe(5000);
    expect(snapshot.payments.find((payment) => payment.method === "sinal")).toMatchObject({ amount: 5000 });
    expect(snapshot.payments.find((payment) => payment.method === "pix")).toMatchObject({ amount: 55000 });
  });

  test("emite recibo do sinal sem concluir a venda nem liberar reserva", async ({ page, request, context, baseURL }) => {
    const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    const reservation = await db.vehicleReservation.create({ data: { vehicleId: flowVehicleId, customerId, deposit: 5000, expiresAt: new Date(Date.now() + 86400000) } });
    await db.vehicle.update({ where: { id: flowVehicleId }, data: { status: "reservado" } });

    await page.goto(`/admin/veiculos/${flowVehicleId}?view=operacao`);
    const reservationPanel = page.locator("details").filter({ has: page.locator("summary", { hasText: "Reserva com sinal" }) });
    await reservationPanel.locator("summary").click();
    await reservationPanel.getByRole("button", { name: "Emitir recibo do sinal" }).click();
    await expect.poll(() => db.commercialDocument.count({ where: { vehicleId: flowVehicleId, kind: "recibo" } })).toBe(1);
    const receipt = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "recibo" } });
    expect(receipt.snapshot).toMatchObject({ amount: 5000, payment: "Sinal", reservationId: reservation.id });
    expect((await db.vehicle.findUniqueOrThrow({ where: { id: flowVehicleId } })).status).toBe("reservado");
    expect(await db.sale.count({ where: { vehicleId: flowVehicleId } })).toBe(0);
  });

  test("emite contrato legado pago só pelo sinal integral", async ({ page, request, context, baseURL }) => {
    const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await db.sale.create({ data: { vehicleId: flowVehicleId, customerId, salePrice: 60000, paymentMethod: "Sinal" } });
    const reservation = await db.vehicleReservation.create({ data: { vehicleId: flowVehicleId, customerId, deposit: 60000, expiresAt: new Date(Date.now() + 86400000), status: "convertida" } });
    const receipt = await db.commercialDocument.create({ data: { vehicleId: flowVehicleId, kind: "recibo", snapshot: { reservationId: reservation.id, customerId, amount: 60000, total: 60000, payment: "Sinal", payments: [{ method: "sinal", amount: 60000 }] } } });
    await db.vehicle.update({ where: { id: flowVehicleId }, data: { status: "vendido" } });

    await page.goto(`/admin/veiculos/${flowVehicleId}?view=operacao`);
    const documents = page.locator("details").filter({ has: page.locator("summary", { hasText: "Contratos e recibos gerados" }) });
    await documents.locator("summary").click();
    await expect(documents.locator('input[name="customerId"]')).toHaveValue(customerId);
    await documents.locator('input[name="legacyPaymentMethod"][value="pix"]').uncheck();
    await documents.getByRole("button", { name: "Emitir contrato desta venda" }).click();
    await expect(documents.getByText(/Contrato nº/)).toBeVisible();

    const contract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" } });
    expect(contract.snapshot).toMatchObject({ saleId: expect.any(String), reservationId: reservation.id, signal: { amount: 60000, receiptId: String(receipt.number) }, payments: [{ method: "sinal", amount: 60000 }] });
  });

  test("emite primeira versão de contrato legado com sinal manual", async ({ page, request, context, baseURL }) => {
    const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await db.sale.create({ data: { vehicleId: flowVehicleId, customerId, salePrice: 60000, paymentMethod: "À vista/PIX" } });
    await db.vehicle.update({ where: { id: flowVehicleId }, data: { status: "vendido" } });

    await page.goto(`/admin/veiculos/${flowVehicleId}?view=operacao`);
    const documents = page.locator("details").filter({ has: page.locator("summary", { hasText: "Contratos e recibos gerados" }) });
    await documents.locator("summary").click();
    await documents.locator('input[name="legacySignalAmount"]').fill("5.000,00");
    await documents.locator('input[name="legacyPaymentAmount_pix"]').fill("55.000,00");
    await documents.getByRole("button", { name: "Emitir contrato desta venda" }).click();
    await expect(documents.getByText(/Contrato nº/)).toBeVisible();

    const contract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" } });
    expect(contract.snapshot).toMatchObject({ saleId: expect.any(String), signal: { amount: 5000 }, payments: [{ method: "sinal", amount: 5000 }, { method: "pix", amount: 55000 }] });
    expect(contract.snapshot).toMatchObject({ reservationId: null });
  });

  test("conclui venda quando sinal da reserva cobre o total negociado", async ({ page, request, context, baseURL }) => {
    const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    const reservation = await db.vehicleReservation.create({ data: { vehicleId: flowVehicleId, customerId: correctedCustomerId, deposit: 60000, expiresAt: new Date(Date.now() + 86400000) } });
    await db.vehicle.update({ where: { id: flowVehicleId }, data: { status: "reservado" } });
    const receipt = await db.commercialDocument.create({ data: { vehicleId: flowVehicleId, kind: "recibo", snapshot: { reservationId: reservation.id, amount: 60000, total: 67000, payment: "Sinal", payments: [{ method: "sinal", amount: 60000 }] } } });
    await db.customer.update({ where: { id: correctedCustomerId }, data: { name: "Cliente corrigido E2E", phone: "27988887777", address: "Rua corrigida, 123" } });

    await page.goto(`/admin/vendas/nova?veiculo=${flowVehicleId}`);
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Cliente corrigido E2E · 27988887777")).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Soma informada: R$ 60.000,00 · Total: R$ 60.000,00")).toBeVisible();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Responsável comercial").fill("Vendedor E2E");
    await page.getByLabel("Comissão (R$)").fill("0");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
    await expect(page.getByRole("heading", { name: "Venda registrada" })).toBeVisible();
    expect((await db.sale.findUniqueOrThrow({ where: { vehicleId: flowVehicleId } })).salePrice).toBe(60000);
    const updatedReceipt = await db.commercialDocument.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(updatedReceipt.snapshot).toMatchObject({ amount: 60000, total: 60000, reservationId: reservation.id, customer: "Cliente corrigido E2E", customerId: correctedCustomerId, phone: "27988887777", address: "Rua corrigida, 123" });
  });

  test("emite nova versão do contrato após corrigir venda e mantém documento anterior", async ({ page, request, context, baseURL }) => {
    const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
    expect(login.ok()).toBeTruthy();
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    const sale = await db.sale.create({ data: { vehicleId: flowVehicleId, customerId, salePrice: 60000, paymentMethod: "À vista/PIX" } });
    await db.vehicle.update({ where: { id: flowVehicleId }, data: { status: "vendido" } });
    const previous = await db.commercialDocument.create({ data: { vehicleId: flowVehicleId, kind: "contrato", snapshot: { saleId: sale.id, customerId, customer: "Nome antigo", total: 60000, amount: 60000, payment: "À vista/PIX", payments: [{ method: "pix", amount: 60000 }] } } });
    await db.sale.update({ where: { id: sale.id }, data: { salePrice: 55000 } });

    await page.goto(`/admin/veiculos/${flowVehicleId}?view=operacao`);
    const documents = page.locator("details").filter({ has: page.locator("summary", { hasText: "Contratos e recibos gerados" }) });
    await documents.locator("summary").click();
    await expect(documents.getByRole("button", { name: "Emitir nova versão do contrato" })).toBeVisible();
    await documents.getByRole("button", { name: "Emitir nova versão do contrato" }).click();

    await expect.poll(() => db.commercialDocument.count({ where: { vehicleId: flowVehicleId, kind: "contrato" } })).toBe(2);
    const current = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato", NOT: { id: previous.id } }, orderBy: { createdAt: "desc" } });
    expect(current.snapshot).toMatchObject({ saleId: sale.id, customerId, total: 55000, amount: 55000, customer: "Cliente Comercial E2E" });
    expect((await db.commercialDocument.findUniqueOrThrow({ where: { id: previous.id } })).snapshot).toMatchObject({ total: 60000, customer: "Nome antigo" });
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
    await expect(page.getByLabel("Valor do sinal", { exact: true })).toHaveCount(0);
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

  for (const withSignal of [false, true]) {
    test(`financiamento sem taxa e ${withSignal ? "com" : "sem"} sinal no fluxo único`, async ({ page, request, context, baseURL }) => {
      const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
      expect(login.ok()).toBeTruthy();
      const cookie = login.headers()["set-cookie"].split(";")[0];
      await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
      await page.goto(`/admin/vendas/nova?veiculo=${flowVehicleId}`);
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: /Cliente Comercial E2E/ }).click();
      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(page.getByLabel("Valor do sinal", { exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Houve sinal" }).click();
      await page.getByLabel("Valor do sinal", { exact: true }).fill("5.000,00");
      // Desmarcar deve descartar o valor oculto e impedir recibo/cláusula de sinal.
      if (!withSignal) await page.getByRole("button", { name: /Houve sinal/ }).click();
      await expect(page.getByLabel("Valor do sinal", { exact: true })).toHaveCount(withSignal ? 1 : 0);
      await page.getByRole("button", { name: /Financiamento/ }).click();
      await expect(page.getByLabel(/taxa|juros|valor da parcela/i)).toHaveCount(0);
      await page.getByLabel("Entrada adicional").fill("10.000,00");
      await page.getByLabel("Valor financiado").fill(withSignal ? "45.000,00" : "50.000,00");
      await page.getByLabel("Número de parcelas").fill("24");
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByLabel("Responsável comercial").fill("Vendedor E2E");
      await page.getByLabel("Comissão (R$)").fill("0");
      await page.getByRole("button", { name: "Continuar" }).click();
      await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
      await expect(page.getByRole("heading", { name: "Venda registrada" })).toBeVisible();
      const contract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" } });
      const snapshot = contract.snapshot as { total: number; signal?: { amount: number }; payments: { method: string; amount: number; downPayment?: number; installments?: number; installmentAmount?: number; rate?: number }[] };
      expect(snapshot.total).toBe(60000);
      expect(snapshot.signal?.amount).toBe(withSignal ? 5000 : undefined);
      expect(snapshot.payments.filter((payment) => payment.method === "sinal")).toHaveLength(withSignal ? 1 : 0);
      expect(snapshot.payments.find((payment) => payment.method === "financiamento")).toEqual({ method: "financiamento", amount: withSignal ? 45000 : 50000, downPayment: 10000, installments: 24 });
      expect(await db.commercialDocument.count({ where: { vehicleId: flowVehicleId, kind: "recibo" } })).toBe(withSignal ? 1 : 0);
      expect(await db.financeSimulation.count({ where: { vehicleId: flowVehicleId } })).toBe(0);
    });
  }

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
    const reservation = await db.vehicleReservation.create({ data: { vehicleId: flowVehicleId, customerId, deposit: 5000, expiresAt: new Date(Date.now() + 86400000), status: "convertida" } });
    const receipt = await db.commercialDocument.create({ data: { vehicleId: flowVehicleId, kind: "recibo", snapshot: { reservationId: reservation.id, customerId, amount: 5000, total: 5000, payment: "Sinal", payments: [{ method: "sinal", amount: 5000 }] } } });
    await db.vehicle.update({ where: { id: flowVehicleId }, data: { status: "vendido" } });

    await page.goto(`/admin/veiculos/${flowVehicleId}?view=operacao`);
    const documents = page.locator("details").filter({ has: page.locator("summary", { hasText: "Contratos e recibos gerados" }) });
    await documents.locator("summary").click();
    await expect(documents.locator('input[name="customerId"]')).toHaveValue(customerId);
    await documents.getByLabel("Valor · À vista/PIX").fill("10.000,00");
    await documents.locator('input[name="legacyPaymentMethod"][value="troca"]').check();
    await documents.getByLabel("Valor · Troca").fill("20.000,00");
    await documents.getByLabel("Veículo/descrição da troca").fill("Fiat Palio 2015");
    await documents.getByLabel("Placa da troca").fill("ODB4A12");
    await documents.locator('input[name="legacyPaymentMethod"][value="cartao"]').check();
    await documents.getByLabel("Valor · Cartão").fill("12.000,00");
    await documents.getByLabel("Parcelas no cartão").fill("6");
    await documents.locator('input[name="legacyPaymentMethod"][value="financiamento"]').check();
    await documents.getByLabel("Valor · Financiamento").fill("20.000,00");
    await documents.getByLabel("Parcelas do financiamento").fill("24");
    await documents.getByRole("button", { name: "Emitir contrato desta venda" }).click();
    await expect(documents.getByText(/Contrato nº/)).toBeVisible();
    expect(await db.sale.count({ where: { vehicleId: flowVehicleId } })).toBe(1);
    const contract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" } });
    expect(contract.snapshot).toMatchObject({ saleId: sale.id, signal: { amount: 5000, receiptId: String(receipt.number) }, reservationId: reservation.id, payments: [
      { method: "sinal", amount: 5000 }, { method: "pix", amount: 10000 },
      { method: "financiamento", amount: 20000, installments: 24 },
      { method: "troca", amount: 20000, tradeVehicle: "Fiat Palio 2015", tradePlate: "ODB4A12" },
      { method: "cartao", amount: 12000, installments: 6 },
    ] });

    await db.commercialDocument.deleteMany({ where: { vehicleId: flowVehicleId, kind: "contrato" } });
    await db.vehicleReservation.deleteMany({ where: { vehicleId: flowVehicleId } });
    const otherCustomerId = "ce2eadminlote4outro";
    await db.customer.upsert({ where: { id: otherCustomerId }, create: { id: otherCustomerId, name: "Outro Cliente E2E", phone: "27999990001" }, update: {} });
    await db.vehicleReservation.create({ data: { vehicleId: flowVehicleId, customerId, deposit: 5000, expiresAt: new Date(Date.now() + 86400000), status: "cancelada" } });
    await db.vehicleReservation.create({ data: { vehicleId: flowVehicleId, customerId: otherCustomerId, deposit: 8000, expiresAt: new Date(Date.now() + 86400000), status: "ativa" } });

    await page.reload();
    await documents.locator("summary").click();
    await expect(documents.locator('input[name="customerId"]')).toHaveValue(customerId);
    await expect(documents.getByLabel("Valor · À vista/PIX")).toHaveValue("67.000,00");
    await documents.getByRole("button", { name: "Emitir contrato desta venda" }).click();
    await expect(documents.getByText(/Contrato nº/)).toBeVisible();
    const withoutEligibleReservation = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" } });
    expect(withoutEligibleReservation.snapshot).toMatchObject({ saleId: sale.id, reservationId: null, payments: [{ method: "pix", amount: 67000 }] });
    expect(withoutEligibleReservation.snapshot).not.toHaveProperty("signal");

    const manualReceipt = await db.commercialDocument.create({ data: { vehicleId: flowVehicleId, kind: "recibo", snapshot: { saleId: sale.id, customerId, amount: 5000, total: 67000, payment: "Sinal", payments: [{ method: "sinal", amount: 5000 }] } } });
    await db.commercialDocument.create({ data: { vehicleId: flowVehicleId, kind: "contrato", snapshot: { saleId: sale.id, customerId, total: 67000, conditions: "Entrega até 30/10/2026", signal: { amount: 5000, receiptId: String(manualReceipt.number), date: new Date().toISOString() }, payments: [{ method: "sinal", amount: 5000 }, { method: "pix", amount: 62000 }] } } });
    await page.reload();
    await documents.locator("summary").click();
    await expect(documents.getByLabel("Sinal já recebido (R$)")).toHaveValue("5.000,00");
    await expect(documents.getByLabel("Condições adicionais")).toHaveValue("Entrega até 30/10/2026");
    await documents.getByLabel("Condições adicionais").fill("Entrega até 31/10/2026");
    const contractIdsBeforeReissue = new Set((await db.commercialDocument.findMany({ where: { vehicleId: flowVehicleId, kind: "contrato" }, select: { id: true } })).map(({ id }) => id));
    await documents.getByRole("button", { name: "Emitir nova versão do contrato" }).click();
    await expect.poll(async () => (await db.commercialDocument.findMany({ where: { vehicleId: flowVehicleId, kind: "contrato" }, select: { id: true } })).some(({ id }) => !contractIdsBeforeReissue.has(id))).toBeTruthy();
    const reissued = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" }, orderBy: { createdAt: "desc" } });
    await expect(documents.locator(`a[href="/api/admin/documentos/${reissued.id}?inline"]`)).toBeVisible();
    expect(reissued.snapshot).toMatchObject({ signal: { amount: 5000, receiptId: String(manualReceipt.number) }, payments: [{ method: "sinal", amount: 5000 }, { method: "pix", amount: 62000 }] });
    expect(reissued.snapshot).toMatchObject({ conditions: "Entrega até 31/10/2026" });

    await db.vehicleReservation.updateMany({ where: { vehicleId: flowVehicleId, customerId, status: "convertida" }, data: { status: "cancelada" } });
    await page.reload();
    await documents.locator("summary").click();
    await documents.getByLabel("Sinal já recebido (R$)").fill("0,00");
    await documents.getByLabel("Valor · À vista/PIX").fill("67.000,00");
    const contractIdsBeforeSignalRemoval = new Set((await db.commercialDocument.findMany({ where: { vehicleId: flowVehicleId, kind: "contrato" }, select: { id: true } })).map(({ id }) => id));
    await documents.getByRole("button", { name: "Emitir nova versão do contrato" }).click();
    await expect.poll(async () => (await db.commercialDocument.findMany({ where: { vehicleId: flowVehicleId, kind: "contrato" }, select: { id: true } })).some(({ id }) => !contractIdsBeforeSignalRemoval.has(id))).toBeTruthy();
    const noSignalContract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" }, orderBy: { createdAt: "desc" } });
    await expect(documents.locator(`a[href="/api/admin/documentos/${noSignalContract.id}?inline"]`)).toBeVisible();
    expect(noSignalContract.snapshot).toMatchObject({ conditions: "Entrega até 31/10/2026", payments: [{ method: "pix", amount: 67000 }] });
    expect(noSignalContract.snapshot).not.toHaveProperty("signal");
    await page.reload();
    await documents.locator("summary").click();
    await expect(documents.getByLabel("Sinal já recebido (R$)")).toHaveValue("0,00");
    await expect(documents.getByLabel("Valor · À vista/PIX")).toHaveValue("67.000,00");

    await db.vehicleReservation.updateMany({ where: { vehicleId: flowVehicleId, customerId: otherCustomerId, status: "ativa" }, data: { status: "cancelada" } });
    await db.sale.update({ where: { id: sale.id }, data: { customerId: otherCustomerId } });
    await page.reload();
    await documents.locator("summary").click();
    await expect(documents.locator('input[name="customerId"]')).toHaveValue(otherCustomerId);
    await expect(documents.getByLabel("Sinal já recebido (R$)")).toHaveValue("0,00");
    await expect(documents.getByLabel("Valor · À vista/PIX")).toHaveValue("67.000,00");
    const contractIdsBeforeBuyerChange = new Set((await db.commercialDocument.findMany({ where: { vehicleId: flowVehicleId, kind: "contrato" }, select: { id: true } })).map(({ id }) => id));
    await documents.getByRole("button", { name: "Emitir nova versão do contrato" }).click();
    await expect.poll(async () => (await db.commercialDocument.findMany({ where: { vehicleId: flowVehicleId, kind: "contrato" }, select: { id: true } })).some(({ id }) => !contractIdsBeforeBuyerChange.has(id))).toBeTruthy();
    const buyerChangedContract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: flowVehicleId, kind: "contrato" }, orderBy: { createdAt: "desc" } });
    await expect(documents.locator(`a[href="/api/admin/documentos/${buyerChangedContract.id}?inline"]`)).toBeVisible();
    expect(buyerChangedContract.snapshot).toMatchObject({ customerId: otherCustomerId, payments: [{ method: "pix", amount: 67000 }] });
    expect(buyerChangedContract.snapshot).not.toHaveProperty("signal");
    // afterAll limpa as reservas antes de excluir o cliente (FK RESTRICT).
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
