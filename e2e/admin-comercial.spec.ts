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

test("giro, avaliação, financiamento, reserva, PDF privado e pós-venda", async ({ page, request, context, baseURL, playwright }) => {
  test.setTimeout(120000);
  const publicRequest = await playwright.request.newContext({ baseURL });
  const unauthenticated = await publicRequest.get("/api/admin/documentos/inexistente");
  expect(unauthenticated.status()).toBe(401);
  const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
  expect(login.ok()).toBeTruthy();
  const cookie = login.headers()["set-cookie"].split(";")[0];
  await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  await page.goto(`/admin/veiculos/${vehicleId}?view=venda`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  const price = page.locator("details").filter({ has: page.locator("summary", { hasText: "Sugestão de preço por giro" }) });
  await price.locator("summary").click();
  await price.getByRole("button", { name: "Aplicar redução" }).click();
  await expect.poll(async () => (await db.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).price).toBe(57000);
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

  const documentPanel = page.locator("details").filter({ has: page.locator('select[name="kind"]') });
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
  const registrar = saleForm.getByRole("button", { name: "Registrar venda", exact: true });
  await registrar.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  expect(await db.sale.count({ where: { vehicleId } })).toBe(0);
  await registrar.click();
  await dialog.getByRole("button", { name: "Registrar venda", exact: true }).click();
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

test("contrato e recibo gerados diretamente no painel de vendas", async ({ page, request, context, baseURL }) => {
  test.setTimeout(90000);
  const login = await request.post("/api/auth/login", { data: { email: "comercial@local.test", password: "comercial-local-123" } });
  expect(login.ok()).toBeTruthy();
  const cookie = login.headers()["set-cookie"].split(";")[0];
  await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);

  const salesVehicleId = "ce2esalespanelvehicle";
  await db.commercialDocument.deleteMany({ where: { vehicleId: salesVehicleId } });
  await db.vehicleReservation.deleteMany({ where: { vehicleId: salesVehicleId } });
  await db.sale.deleteMany({ where: { vehicleId: salesVehicleId } });
  await db.vehicle.deleteMany({ where: { id: salesVehicleId } });
  await db.vehicle.create({
    data: {
      id: salesVehicleId,
      brand: "Toyota",
      model: "Corolla Vendas E2E",
      year: 2022,
      yearModel: 2022,
      km: 30000,
      price: 110000,
      purchasePrice: 95000,
      fuel: "Flex",
      transmission: "Automático",
      plate: "BRA2E19",
    },
  });

  try {
    await page.goto("/admin/vendas");
    await page.getByRole("button", { name: "Contrato e recibo" }).click();
    await expect(page.getByRole("heading", { name: "Contrato de compra e venda e recibo de sinal" })).toBeVisible();

    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /Corolla Vendas E2E/ }).click();

    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: /Cliente Comercial E2E/ }).click();

    // 1. Gera recibo de sinal com prazo de reserva (expiresAt), criando reserva e marcando como reservado
    await page.locator('input[name="deposit"]').fill("10.000,00");
    await page.locator('input[name="expiresAt"]').fill("2099-01-01T10:00");
    await page.locator('input[name="payment"]').fill("Pix chave CNPJ");
    await page.locator('textarea[name="conditions"]').fill("Sinal de reserva com garantia de prazo.");

    await page.getByRole("button", { name: "Gerar recibo de sinal (PDF)" }).click();
    await expect(page.getByText(/Recibo de sinal nº \d+ gerado!/)).toBeVisible();

    const receiptDoc = await db.commercialDocument.findFirstOrThrow({
      where: { vehicleId: salesVehicleId, kind: "recibo" },
      orderBy: { createdAt: "desc" },
    });
    expect(receiptDoc.number).toBeGreaterThan(0);
    const receiptPdf = await page.request.get(`/api/admin/documentos/${receiptDoc.id}`);
    expect(receiptPdf.status()).toBe(200);
    expect(receiptPdf.headers()["content-type"]).toBe("application/pdf");
    expect((await receiptPdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // Confere que o status do veículo passou a reservado e a reserva ativa foi criada com o prazo e sinal
    const reservedVehicle = await db.vehicle.findUniqueOrThrow({ where: { id: salesVehicleId } });
    expect(reservedVehicle.status).toBe("reservado");
    const activeReservation = await db.vehicleReservation.findFirstOrThrow({
      where: { vehicleId: salesVehicleId, status: "ativa" },
    });
    expect(Number(activeReservation.deposit)).toBe(10000);

    // 2. Gera contrato de compra e venda com múltiplas formas (Sinal + PIX + Troca + Financiamento)
    // Ao gerar recibo de sinal, o chip "Sinal" (10.000) foi marcado automaticamente junto ao "À vista/PIX" (110.000),
    // então a soma passa a 120.000 e deve mostrar aviso de diferença até ajustar os valores.
    await expect(page.getByText(/Aviso: a soma das formas de pagamento/)).toBeVisible();

    await page.locator('input[name="pixAmount"]').fill("15.000,00");
    await page.getByRole("button", { name: "Troca (carro na troca)" }).click();
    await page.locator('input[name="tradeVehicle"]').fill("Fiat Palio 2015");
    await page.locator('input[name="tradePlate"]').fill("ODB4A12");
    await page.locator('input[name="tradeAmount"]').fill("25.000,00");

    await page.getByRole("button", { name: "Financiamento" }).click();
    await page.locator('input[name="bank"]').fill("Santander");
    await page.locator('input[name="financed"]').fill("60.000,00");

    await expect(page.getByTestId("payment-sum-status")).toContainText("Total confere");
    await page.locator('textarea[name="conditions"]').fill("Garantia de 90 dias de motor e câmbio.");

    await page.getByRole("button", { name: "Gerar contrato (PDF)" }).click();
    await expect(page.getByText(/Contrato de compra e venda nº \d+ gerado!/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir PDF" }).first()).toBeVisible();

    const contractDoc = await db.commercialDocument.findFirstOrThrow({
      where: { vehicleId: salesVehicleId, kind: "contrato" },
      orderBy: { createdAt: "desc" },
    });
    expect(contractDoc.number).toBeGreaterThan(0);
    const snap = contractDoc.snapshot as { payments?: { method: string; amount: number }[] };
    expect(Array.isArray(snap.payments)).toBe(true);
    expect(snap.payments?.length).toBe(4);
    const contractPdf = await page.request.get(`/api/admin/documentos/${contractDoc.id}`);
    expect(contractPdf.status()).toBe(200);
    expect(contractPdf.headers()["content-type"]).toBe("application/pdf");
    expect((await contractPdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  } finally {
    await db.commercialDocument.deleteMany({ where: { vehicleId: salesVehicleId } });
    await db.vehicleReservation.deleteMany({ where: { vehicleId: salesVehicleId } });
    await db.sale.deleteMany({ where: { vehicleId: salesVehicleId } });
    await db.vehicle.deleteMany({ where: { id: salesVehicleId } });
  }
});
