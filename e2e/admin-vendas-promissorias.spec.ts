import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";

const db = new PrismaClient();
const test = base.extend<{ saleData: { vehicleId: string; customerId: string; noteId: string; number: number } }>({
  saleData: async ({ page, context, baseURL }, executar) => {
    const suffix = randomUUID();
    const email = `contrato-notas-${suffix}@local.test`;
    const password = "contrato-notas-local-123";
    const admin = await db.admin.create({ data: { name: "Teste contrato promissórias", email, passwordHash: await bcrypt.hash(password, 4) } });
    const customer = await db.customer.create({ data: { name: "Comprador Fictício Promissórias", cpf: "11144477735", phone: `279${randomInt(10000000, 99999999)}`, address: "Rua Fictícia, 100, Linhares/ES" } });
    const vehicle = await db.vehicle.create({ data: { brand: "Fiat", model: `Contrato Notas ${suffix}`, year: 2022, yearModel: 2023, km: 10000, price: 2500.01, fuel: "Flex", transmission: "Manual" } });
    const note = await db.promissoryNote.create({ data: {
      customerId: customer.id, issuerName: customer.name, issuerCpf: "111.444.777-35", issuerPhone: customer.phone, issuerAddress: customer.address!, issuerBirthDate: new Date("1980-01-01"),
      amount: "1500.01", dueDate: new Date("2027-01-31"), issuedAt: new Date("2026-10-30"), issuePlace: "Linhares/ES", paymentPlace: "Linhares/ES",
    } });
    try {
      await page.route("**/fotos/**", (route) => route.fulfill({ path: "public/branding/placeholder-car.png", contentType: "image/png" }));
      await page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.19.${randomInt(256)}.${randomInt(1, 255)}` });
      const login = await page.request.post("/api/auth/login", { data: { email, password } });
      expect(login.ok()).toBeTruthy();
      const cookie = login.headers()["set-cookie"].split(";")[0];
      await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
      await page.goto(`/admin/vendas/nova?veiculo=${vehicle.id}&cliente=${customer.id}`);
      await executar({ vehicleId: vehicle.id, customerId: customer.id, noteId: note.id, number: note.number });
    } finally {
      await db.promissoryNote.deleteMany({ where: { customerId: customer.id } });
      await db.sale.deleteMany({ where: { vehicleId: vehicle.id } });
      await db.vehicle.delete({ where: { id: vehicle.id } });
      await db.customer.delete({ where: { id: customer.id } });
      await db.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await db.admin.delete({ where: { id: admin.id } });
    }
  },
});
test.afterAll(async () => { await db.$disconnect(); });

async function next(page: Page, heading: string) {
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
}

async function paymentStage(page: Page) {
  await next(page, "Cliente");
  await next(page, "Pagamento");
  await page.getByRole("button", { name: "+ Promissória", exact: true }).click();
}

async function review(page: Page) {
  await next(page, "Vendedor");
  await next(page, "Revisar e gerar contrato");
}

async function checkContract(page: Page, data: { vehicleId: string; customerId: string }, count: number) {
  await expect(page.getByRole("heading", { name: "Venda registrada", exact: true })).toBeVisible();
  const sale = await db.sale.findUniqueOrThrow({ where: { vehicleId: data.vehicleId }, include: { promissoryNotes: true } });
  expect(sale.customerId).toBe(data.customerId);
  expect(sale.salePrice).toBe(2500.01);
  expect(sale.promissoryNotes).toHaveLength(count);
  for (const note of sale.promissoryNotes) expect(note.status).toBe("vinculada");
  const contract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: data.vehicleId, kind: "contrato" } });
  const snapshot = contract.snapshot as { payments: { method: string; noteIds?: string[]; notes?: unknown[] }[] };
  const payment = snapshot.payments.find((item) => item.method === "promissoria")!;
  expect(payment.noteIds?.sort()).toEqual(sale.promissoryNotes.map((note) => note.id).sort());
  expect(payment.notes).toEqual(sale.promissoryNotes.sort((a, b) => a.number - b.number).map((note) => ({ id: note.id, number: note.number, amount: Number(note.amount), dueDate: note.dueDate.toISOString().slice(0, 10) })));
  const response = await page.request.get(`/api/admin/documentos/${contract.id}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect((await PDFDocument.load(await response.body())).getPageCount()).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("contrato: notas existentes + PIX, divergência e nota paga não deixam venda parcial", async ({ page, saleData }) => {
  test.setTimeout(120000);
  await paymentStage(page);
  const panel = page.getByRole("region", { name: "Pagamento em promissórias" });
  await panel.getByRole("checkbox", { name: new RegExp(`Nota nº ${saleData.number} ·`) }).check();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/Faltam.*1\.000,00/);
  await page.getByRole("button", { name: /À vista\/PIX/ }).click();
  await page.getByLabel("Valor", { exact: true }).fill("1.000,00");
  await page.getByLabel("Valor", { exact: true }).blur();
  await review(page);
  await db.promissoryNote.update({ where: { id: saleData.noteId }, data: { amount: "1500.02" } });
  await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
  await expect(page.getByText(/A soma das notas difere/)).toBeVisible();
  expect(await db.sale.count({ where: { vehicleId: saleData.vehicleId } })).toBe(0);
  expect(await db.commercialDocument.count({ where: { vehicleId: saleData.vehicleId } })).toBe(0);
  await db.promissoryNote.update({ where: { id: saleData.noteId }, data: { amount: "1500.01", status: "paga" } });
  await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
  await expect(page.getByText(/Uma nota foi paga, cancelada ou vinculada/)).toBeVisible();
  expect((await db.vehicle.findUniqueOrThrow({ where: { id: saleData.vehicleId } })).status).toBe("disponivel");
  expect((await db.promissoryNote.findUniqueOrThrow({ where: { id: saleData.noteId } })).saleId).toBeNull();
  await db.promissoryNote.update({ where: { id: saleData.noteId }, data: { status: "emitida" } });
  const posted = page.waitForRequest((request) => request.method() === "POST" && Boolean(request.headers()["next-action"]) && Boolean(request.postData()?.includes(saleData.vehicleId)));
  await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
  const original = await posted;
  await checkContract(page, saleData, 1);
  await db.promissoryNote.update({ where: { id: saleData.noteId }, data: { status: "paga", paidAt: new Date() } });
  const repeated = await page.request.post(original.url(), { headers: original.headers(), data: original.postData()! });
  expect(repeated.ok()).toBe(true);
  expect(await repeated.text()).toContain('"ok":true');
  expect(await db.sale.count({ where: { vehicleId: saleData.vehicleId } })).toBe(1);
  expect(await db.commercialDocument.count({ where: { vehicleId: saleData.vehicleId, kind: "contrato" } })).toBe(1);
});

test("contrato: emite parcelas sem sair da venda, seleciona automaticamente e mantém ao voltar", async ({ page, saleData }, testInfo) => {
  test.setTimeout(120000);
  await paymentStage(page);
  await page.getByRole("button", { name: "Emitir notas nesta venda", exact: true }).click();
  const form = page.getByRole("form", { name: "Emitir notas nesta venda" });
  await form.getByRole("button", { name: "Emitir e selecionar notas" }).click();
  await expect(form.getByText("Informe a data de nascimento.")).toBeVisible();
  expect(await db.promissoryNote.count({ where: { customerId: saleData.customerId } })).toBe(1);
  await form.getByLabel("Data de nascimento").fill("1980-01-01");
  await form.getByLabel("Valor de cada nota (R$)").fill("1.000,00");
  await form.getByLabel("Quantidade de notas").fill("2");
  await form.getByLabel("Primeiro vencimento").fill("2027-01-31");
  await expect(form.getByRole("status")).toContainText("total R$ 2.000,00");
  await page.screenshot({ path: testInfo.outputPath("emissao-no-pagamento.png"), fullPage: true });
  await form.getByRole("button", { name: "Emitir e selecionar notas" }).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Pagamento em promissórias" })).toContainText("2 nota(s) selecionada(s)");
  const notes = await db.promissoryNote.findMany({ where: { customerId: saleData.customerId, id: { not: saleData.noteId } }, orderBy: { number: "asc" } });
  expect(notes.map((note) => note.dueDate.toISOString().slice(0, 10))).toEqual(["2027-01-31", "2027-02-28"]);
  expect(notes.every((note) => note.saleId === null && note.status === "emitida")).toBe(true);
  await page.getByRole("button", { name: /À vista\/PIX/ }).click();
  await page.getByLabel("Valor", { exact: true }).fill("500,01");
  await page.getByLabel("Valor", { exact: true }).blur();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await review(page);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.getByRole("region", { name: "Pagamento em promissórias" })).toContainText("2 nota(s) selecionada(s)");
  await review(page);
  await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
  await checkContract(page, saleData, 2);
  expect((await db.promissoryNote.findUniqueOrThrow({ where: { id: saleData.noteId } })).saleId).toBeNull();
});
