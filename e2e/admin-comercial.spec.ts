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
  await db.vehicle.create({ data: { id: vehicleId, brand: "Honda", model: "Civic Comercial E2E", year: 2020, yearModel: 2020, km: 50000, price: 60000, purchasePrice: 50000, fipePrice: 58000, fuel: "Flex", transmission: "Automático", createdAt: new Date(Date.now() - 100 * 86400000) } });
});
test.afterAll(async () => {
  await db.sale.deleteMany({ where: { vehicleId } });
  await db.vehicle.deleteMany({ where: { id: vehicleId } });
  await db.customer.deleteMany({ where: { id: customerId } });
  await db.admin.deleteMany({ where: { email: "comercial@local.test" } });
  await db.$disconnect();
});

test("giro, avaliação, financiamento, reserva, PDF privado e pós-venda", async ({ page, request, context, baseURL, playwright }) => {
  test.setTimeout(120000);
  const publicRequest = await playwright.request.newContext({ baseURL });
  const unauthenticated = await publicRequest.get("/api/admin/documentos/inexistente");
  expect(unauthenticated.status()).toBe(401);
  const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
  expect(login.ok()).toBeTruthy();
  const cookie = login.headers()["set-cookie"].split(";")[0];
  await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`/admin/veiculos/${vehicleId}?view=operacao`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  const price = page.locator("details").filter({ has: page.locator("summary", { hasText: "Sugestão de preço por giro" }) });
  await price.locator("summary").click();
  await price.getByRole("button", { name: "Aplicar redução" }).click();
  await expect.poll(async () => (await db.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).price).toBe(55100);
  expect(await db.vehiclePriceHistory.count({ where: { vehicleId } })).toBe(2);

  const assessment = page.locator("details").filter({ has: page.locator("summary", { hasText: "Checklist de entrada" }) });
  await assessment.locator("summary").click();
  for (let index = 0; index < 14; index++) await assessment.locator(`select[name=item${index}]`).selectOption("ok");
  await assessment.locator("input[name=offer]").fill("50.000,00");
  await assessment.getByRole("checkbox").check();
  await assessment.getByRole("button", { name: "Salvar avaliação" }).click();
  await expect.poll(async () => (await db.vehicleAssessment.findUnique({ where: { vehicleId } }))?.approved).toBe(true);

  const finance = page.locator("details").filter({ has: page.locator("summary", { hasText: "Simulador e acompanhamento" }) });
  await finance.locator("summary").click();
  await finance.locator("input[name=customerName]").fill("Cliente Comercial E2E");
  await finance.locator("input[name=bank]").fill("Banco de teste");
  await finance.getByRole("button", { name: "Calcular parcelas" }).click();
  await expect(finance.getByText(/juros estimados/)).toBeVisible();
  await finance.getByRole("button", { name: "Salvar simulação" }).click();
  await expect.poll(async () => db.financeSimulation.count({ where: { vehicleId } })).toBe(1);
  await finance.locator("select[name=status]").selectOption("enviada");
  await finance.getByRole("button", { name: "Atualizar acompanhamento" }).click();
  await expect.poll(async () => (await db.financeSimulation.findFirstOrThrow({ where: { vehicleId } })).status).toBe("enviada");

  const reserve = page.locator("details").filter({ has: page.locator("summary", { hasText: "Reserva com sinal" }) });
  await reserve.locator("summary").click();
  await reserve.getByRole("combobox").click();
  await reserve.getByRole("option", { name: /Cliente Comercial E2E/ }).click();
  await reserve.locator("input[name=deposit]").fill("1.000,00");
  await reserve.locator("input[name=expiresAt]").fill("2099-01-01T10:00");
  await reserve.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect.poll(async () => (await db.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).status).toBe("reservado");

  const documentPanel = page.locator("details").filter({ has: page.locator("summary", { hasText: "Proposta e recibo" }) });
  await documentPanel.locator("summary").click();
  await documentPanel.locator("select[name=kind]").selectOption("recibo");
  await documentPanel.getByRole("combobox").nth(1).click();
  await documentPanel.getByRole("option", { name: /Cliente Comercial E2E/ }).click();
  await documentPanel.locator("input[name=amount]").fill("1.000,00");
  await documentPanel.locator("input[name=payment]").fill("Pix");
  await documentPanel.locator("textarea[name=conditions]").fill("Sinal recebido. Saldo a combinar. Prazo informado na reserva.");
  await documentPanel.getByRole("button", { name: "Gerar PDF" }).click();
  await expect(documentPanel.getByRole("link", { name: "Abrir PDF" }).first()).toBeVisible();
  const doc = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId } });
  expect((await publicRequest.get(`/api/admin/documentos/${doc.id}`)).status()).toBe(401);
  await publicRequest.dispose();
  const pdf = await page.request.get(`/api/admin/documentos/${doc.id}`);
  expect(pdf.headers()["cache-control"]).toBe("private, no-store");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Expiração sem depender do relógio ou de serviços externos.
  await db.vehicleReservation.updateMany({ where: { vehicleId, status: "ativa" }, data: { createdAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() - 1000) } });
  await expireReservations();
  expect((await db.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).status).toBe("disponivel");
  await db.vehicleReservation.create({ data: { vehicleId, customerId, deposit: 1000, expiresAt: new Date(Date.now() + 86400000) } });
  await db.vehicle.update({ where: { id: vehicleId }, data: { status: "reservado" } });
  await page.goto(`/admin/vendas?vehicle=${vehicleId}`);
  const saleForm = page.locator("form").filter({ has: page.locator('input[name="source"]') });
  await saleForm.locator('input[name="salePrice"]').fill("55.100,00");
  await saleForm.locator('select[name="paymentMethod"]').selectOption("À vista (Pix/dinheiro)");
  page.once("dialog", (dialog) => dialog.accept());
  await saleForm.getByRole("button", { name: "Registrar venda", exact: true }).click();
  await expect.poll(async () => db.sale.count({ where: { vehicleId } })).toBe(1);
  const sale = await db.sale.findUniqueOrThrow({ where: { vehicleId } });
  expect(sale.customerId).toBe(customerId);
  expect(sale.notes).toContain("Sinal recebido: R$ 1000.00 (incluído no total da venda).");
  expect(await db.afterSaleTask.count({ where: { saleId: sale.id } })).toBe(4);
  await db.$transaction(async (tx) => { await scheduleAfterSale(tx, sale); await scheduleAfterSale(tx, sale); });
  expect(await db.afterSaleTask.count({ where: { saleId: sale.id } })).toBe(4);
  await page.goto("/admin/agenda");
  await expect(page.getByRole("heading", { name: /Cliente Comercial E2E · Entrega/ })).toBeVisible();
  await page.getByRole("button", { name: "Marcar tarefa concluída" }).click();
  await expect.poll(async () => db.afterSaleTask.count({ where: { saleId: sale.id, completedAt: { not: null } } })).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
