import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
if (process.env.E2E_TEST !== "1" || !["localhost", "127.0.0.1"].includes(database.hostname) || !["/ci", "/garagem_e2e"].includes(database.pathname)) throw new Error("Auditoria exige banco local descartável.");
const db = new PrismaClient();
type Fixture = { adminId: string; vehicleId: string; customerId: string; name: string };
const test = base.extend<{ audit: Fixture }>({
  audit: async ({ page, context, baseURL }, run) => {
    const suffix = randomUUID();
    const email = `auditoria-${suffix}@local.test`;
    const password = "auditoria-local-ficticia";
    const admin = await db.admin.create({ data: { name: "Auditoria Fictícia", email, passwordHash: await bcrypt.hash(password, 4) } });
    const customer = await db.customer.create({ data: { name: `Cliente Fictício ${suffix}`, phone: "27999990000", cpf: "11144477735", address: "Rua Fictícia, 1" } });
    const vehicle = await db.vehicle.create({ data: { brand: "Fiat", model: `Auditoria ${suffix}`, year: 2022, yearModel: 2023, price: 1000, km: 10000, fuel: "Flex", transmission: "Manual" } });
    await page.route("**/fotos/**", route => route.fulfill({ path: "public/branding/placeholder-car.png", contentType: "image/png" }));
    await page.route("**/*.supabase.co/storage/**", route => route.abort());
    try {
      const login = await page.request.post("/api/auth/login", { data: { email, password }, headers: { "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}` } });
      expect(login.ok()).toBeTruthy();
      const cookie = login.headers()["set-cookie"].split(";")[0];
      await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
      await run({ adminId: admin.id, customerId: customer.id, vehicleId: vehicle.id, name: customer.name });
    } finally {
      await db.adminDraft.deleteMany({ where: { adminId: admin.id } });
      await db.promissoryNote.deleteMany({ where: { OR: [{ customerId: customer.id }, { issuerName: customer.name }] } });
      await db.commercialDocument.deleteMany({ where: { vehicleId: vehicle.id } });
      await db.vehicleReservation.deleteMany({ where: { vehicleId: vehicle.id } });
      await db.sale.deleteMany({ where: { vehicleId: vehicle.id } });
      await db.vehicle.delete({ where: { id: vehicle.id } });
      await db.customer.delete({ where: { id: customer.id } });
      await db.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await db.admin.delete({ where: { id: admin.id } });
    }
  },
});
test.afterAll(() => db.$disconnect());

test("consulta clientes e reimprime notas antes da migration do admin", async ({ page, audit }) => {
  const note = await db.promissoryNote.create({ data: {
    customerId: audit.customerId, issuerName: audit.name, issuerCpf: "111.444.777-35",
    issuerBirthDate: new Date("1980-01-01"), issuerPhone: "27999990000", issuerAddress: "Rua Fictícia, 1",
    amount: 100, dueDate: new Date("2027-01-31"), issuedAt: new Date("2026-11-01"),
    issuePlace: "Linhares/ES", paymentPlace: "Linhares/ES",
  } });
  // Renomear simula a migration ausente e preserva dados e índices na restauração.
  await db.$transaction([
    db.$executeRaw`ALTER TABLE "Customer" RENAME COLUMN "updatedAt" TO "updatedAt_teste"`,
    db.$executeRaw`ALTER TABLE "PromissoryNote" RENAME COLUMN "issuanceKey" TO "issuanceKey_teste"`,
    db.$executeRaw`ALTER TABLE "PromissoryNote" RENAME COLUMN "issuanceHash" TO "issuanceHash_teste"`,
  ]);
  try {
    await page.goto(`/admin/clientes?q=${encodeURIComponent(audit.name)}`);
    await expect(page.getByText(audit.name, { exact: true })).toBeVisible();
    await page.goto("/admin/promissorias");
    await expect(page.getByText(audit.name, { exact: true })).toBeVisible();
    const pdf = await page.request.get(`/api/admin/promissorias/${note.id}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
  } finally {
    await db.$transaction([
      db.$executeRaw`ALTER TABLE "Customer" RENAME COLUMN "updatedAt_teste" TO "updatedAt"`,
      db.$executeRaw`ALTER TABLE "PromissoryNote" RENAME COLUMN "issuanceKey_teste" TO "issuanceKey"`,
      db.$executeRaw`ALTER TABLE "PromissoryNote" RENAME COLUMN "issuanceHash_teste" TO "issuanceHash"`,
    ]);
  }
});

test("venda recupera rascunho privado, etapa e foco após recarregar", async ({ page, audit }) => {
  await page.goto(`/admin/vendas/nova?veiculo=${audit.vehicleId}&cliente=${audit.customerId}`);
  await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cliente", exact: true })).toBeFocused();
  await expect(page.locator('[aria-current="step"]')).toContainText("Cliente");
  await page.getByLabel("Endereço", { exact: false }).fill("Rua Fictícia Não Persistida, 123");
  await expect(page.getByRole("status").filter({ hasText: "Rascunho guardado" })).toBeVisible();
  const draft = await db.adminDraft.findFirstOrThrow({ where: { adminId: audit.adminId, key: { startsWith: "sale:" } } });
  expect(draft.photoUrls).toEqual([]);
  expect(JSON.stringify(draft.payload)).not.toMatch(/Rua Fictícia Não Persistida|27999990000|11144477735|"rg"|"customer"/);
  expect(draft.expiresAt.getTime() - draft.updatedAt.getTime()).toBeLessThanOrEqual(86400000);
  await page.reload();
  await expect(page.getByLabel("Endereço", { exact: false })).toHaveValue("Rua Fictícia, 1");
  await expect(page.getByRole("heading", { name: "Cliente", exact: true })).toBeFocused();
  const serialized = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(serialized).not.toContain("Rua Fictícia Não Persistida");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

async function fillNote(page: Page, audit: Fixture) {
  await page.goto("/admin/promissorias");
  await page.getByRole("button", { name: "Nova promissória" }).click();
  const form = page.getByRole("form", { name: "Nova promissória" });
  await form.getByRole("combobox").fill(audit.name);
  await page.getByRole("option", { name: new RegExp(audit.name) }).click();
  const values = { name: audit.name, cpf: "11144477735", phone: "27999990000", birthDate: "1980-01-01", address: "Rua Fictícia, 1", amount: "100,00", firstDueDate: "2027-01-31" };
  for (const [name, value] of Object.entries(values)) {
    const input = form.locator(`input[name=${name}]`);
    await input.fill(value);
  }
  return form;
}

test("resposta perdida da emissão não duplica o lote; baixa pode ser retificada", async ({ page, audit }) => {
  test.setTimeout(60000);
  const form = await fillNote(page, audit);
  let lost = false;
  await page.route("**/admin/promissorias", async route => {
    if (!lost && route.request().method() === "POST" && route.request().headers()["next-action"]) {
      lost = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await form.getByRole("button", { name: "Emitir nota", exact: true }).click();
  await expect.poll(() => db.promissoryNote.count({ where: { issuerName: audit.name } })).toBe(1);
  const first = await db.promissoryNote.findFirstOrThrow({ where: { issuerName: audit.name } });
  await expect(form.getByRole("button", { name: "Emitir nota", exact: true })).toBeEnabled();
  await form.getByRole("button", { name: "Emitir nota", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(await db.promissoryNote.count({ where: { issuerName: audit.name } })).toBe(1);
  const row = page.getByTestId("promissoria").filter({ hasText: audit.name });
  await row.getByRole("button", { name: /Marcar nota .* como paga/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Marcar como paga", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.goto(`/admin/promissorias?status=pagas&q=${first.number}`);
  await page.getByRole("button", { name: "Retificar baixa" }).click();
  const reversal = page.getByRole("form", { name: "Retificar baixa" });
  await reversal.getByRole("textbox").fill("Baixa lançada por engano no teste fictício");
  await reversal.getByRole("button", { name: "Confirmar retificação" }).click();
  await expect(reversal).toHaveCount(0);
  expect((await db.promissoryNote.findUniqueOrThrow({ where: { id: first.id } })).status).toBe("emitida");
  expect(await db.adminAudit.count({ where: { entityId: first.id, action: "promissory.payment.reversed" } })).toBe(1);
});

test("busca do assistente distingue sessão expirada de lista vazia", async ({ page, audit }) => {
  await page.route("**/api/admin/vendas/veiculos?**", route => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
  await page.goto(`/admin/vendas/nova?cliente=${audit.customerId}`);
  await page.getByRole("combobox").click();
  await expect(page.getByRole("alert").filter({ hasText: "Sessão expirada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
});

test("edição concorrente de cliente preserva o digitado e impede sobrescrita", async ({ page, audit }) => {
  await page.goto(`/admin/clientes?cliente=${audit.customerId}`);
  await page.getByRole("button", { name: "Editar cliente" }).click();
  const form = page.locator("form").filter({ has: page.locator('input[name="expectedUpdatedAt"]') });
  await form.locator('input[name="name"]').fill("Nome Fictício Digitado");
  await db.customer.update({ where: { id: audit.customerId }, data: { name: "Nome Fictício da Outra Sessão" } });
  await form.getByRole("button", { name: /Salvar/ }).click();
  await expect(page.getByText(/cadastro mudou em outra sessão/)).toBeVisible();
  await expect(form.locator('input[name="name"]')).toHaveValue("Nome Fictício Digitado");
  expect((await db.customer.findUniqueOrThrow({ where: { id: audit.customerId } })).name).toBe("Nome Fictício da Outra Sessão");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("banco impede apagar anúncio com reserva, sinal e recibo", async ({ audit }) => {
  const reservation = await db.vehicleReservation.create({ data: { vehicleId: audit.vehicleId, customerId: audit.customerId, deposit: "100.00", expiresAt: new Date("2027-01-31") } });
  const receipt = await db.commercialDocument.create({ data: { vehicleId: audit.vehicleId, kind: "recibo", snapshot: { reservationId: reservation.id, amount: 100, customer: audit.name } } });
  await expect(db.vehicle.delete({ where: { id: audit.vehicleId } })).rejects.toThrow();
  expect((await db.vehicleReservation.findUniqueOrThrow({ where: { id: reservation.id } })).deposit.toString()).toBe("100");
  expect((await db.commercialDocument.findUniqueOrThrow({ where: { id: receipt.id } })).snapshot).toMatchObject({ amount: 100, reservationId: reservation.id });
  await db.vehicleReservation.delete({ where: { id: reservation.id } });
  await expect(db.vehicle.delete({ where: { id: audit.vehicleId } })).rejects.toThrow();
  expect(await db.commercialDocument.count({ where: { id: receipt.id } })).toBe(1);
});

test("agenda pagina tarefas e avisos, aplica busca e explica o alcance dos contadores", async ({ page, audit }) => {
  const sale = await db.sale.create({ data: { vehicleId: audit.vehicleId, customerId: audit.customerId, salePrice: 1000, paymentMethod: "Pix", saleDate: new Date() } });
  await db.afterSaleTask.createMany({ data: Array.from({ length: 51 }, (_, index) => ({ saleId: sale.id, kind: `tarefa-ficticia-${index}`, dueAt: new Date() })) });
  await db.promissoryNote.createMany({ data: Array.from({ length: 51 }, () => ({ customerId: audit.customerId, issuerName: audit.name, issuerCpf: "111.444.777-35", issuerBirthDate: new Date("1980-01-01"), issuerPhone: "27999990000", issuerAddress: "Rua Fictícia, 1", amount: 10, dueDate: new Date("2027-01-31"), issuedAt: new Date("2026-11-01"), issuePlace: "Linhares/ES", paymentPlace: "Linhares/ES", status: "paga", paidAt: new Date("2020-01-01") })) });
  await page.goto(`/admin/agenda?q=${encodeURIComponent(audit.name)}`);
  const tasks = page.getByRole("region", { name: "Pós-venda", exact: true });
  const notices = page.getByRole("region", { name: "Promissórias pagas", exact: true });
  await expect(page.getByRole("navigation", { name: "Período da agenda" })).toContainText("Atendimentos");
  await expect(tasks.getByRole("article")).toHaveCount(50);
  await expect(notices.getByRole("article")).toHaveCount(50);
  await expect(notices).toContainText("todos os períodos");
  await page.getByRole("link", { name: "Próximas tarefas" }).click();
  await expect(tasks.getByRole("article")).toHaveCount(1);
  await expect(notices.getByRole("article")).toHaveCount(50);
  await page.getByRole("link", { name: "Próximos avisos" }).click();
  await expect(notices.getByRole("article")).toHaveCount(1);
  await expect(tasks.getByRole("article")).toHaveCount(1);
  await page.goto("/admin/agenda?q=cliente-ficticio-inexistente-999");
  await expect(tasks.getByRole("article")).toHaveCount(0);
  await expect(notices).toHaveCount(0);
});

test("ações de vendas e clientes têm espaço de toque nas telas estreitas", async ({ page, audit }) => {
  await db.sale.create({ data: { vehicleId: audit.vehicleId, customerId: audit.customerId, salePrice: 1000, paymentMethod: "Pix", saleDate: new Date() } });
  await db.vehicle.update({ where: { id: audit.vehicleId }, data: { status: "vendido" } });
  await page.goto(`/admin/vendas?q=${encodeURIComponent(audit.name)}`);
  for (const name of ["Editar venda", "Desfazer venda"]) {
    const button = page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width < 1024 ? 100 : 32); expect(box!.height).toBeGreaterThanOrEqual(page.viewportSize()!.width < 1024 ? 44 : 32);
  }
  await page.goto(`/admin/clientes?cliente=${audit.customerId}`);
  const button = page.getByRole("button", { name: "Excluir cliente", exact: true }).filter({ visible: true }).first();
  const box = await button.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(page.viewportSize()!.width < 1024 ? 100 : 32); expect(box!.height).toBeGreaterThanOrEqual(page.viewportSize()!.width < 1024 ? 44 : 32);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("fotos permitem giro no celular, borrão com área útil e kit com fechar de 44px", async ({ page, audit }) => {
  await db.photo.create({ data: { vehicleId: audit.vehicleId, url: "/fotos/fixture-auditoria.webp", order: 0 } });
  await page.route("**/api/upload/rotate?**", route => route.fulfill({ status: 200, contentType: "application/json", body: '{"hasPrevious":false}' }));
  await page.goto(`/admin/veiculos/${audit.vehicleId}`);
  await expect(page.locator('input[type="file"]').first()).toBeEnabled();
  const menu = page.getByRole("button", { name: "Mais ações da foto 1", exact: true });
  if (page.viewportSize()!.width < 1024) {
    await menu.click();
    await page.getByRole("button", { name: /^Girar foto/ }).click();
  } else await page.getByRole("button", { name: /^Girar foto/ }).click();
  await expect(page.getByRole("dialog", { name: "Girar foto", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fechar rotação" }).click();
  await page.getByRole("button", { name: "Borrar placa", exact: true }).filter({ visible: true }).click();
  const blur = page.getByRole("dialog", { name: "Borrar placa", exact: true });
  await expect(blur).toBeVisible();
  const canvas = blur.locator(".touch-none");
  await expect(canvas).toBeVisible();
  expect((await canvas.boundingBox())!.width).toBeGreaterThanOrEqual(220);
  expect(await canvas.evaluate(element => getComputedStyle(element).touchAction)).toBe("none");
  const viewport = blur.locator(".overscroll-contain");
  const beforeZoom = (await viewport.boundingBox())!.height;
  await blur.getByRole("slider", { name: "Ampliar foto" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(blur.getByRole("slider", { name: "Ampliar foto" })).toHaveValue("1.25");
  if (page.viewportSize()!.width < 640) {
    await expect(blur.locator("header")).toBeHidden();
    expect((await viewport.boundingBox())!.height).toBeGreaterThan(beforeZoom + 60);
  }
  await blur.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Mais ações do anúncio", exact: true }).click();
  await page.getByRole("button", { name: /^Kit de divulgação/ }).click();
  const kit = page.getByRole("dialog", { name: "Kit de Divulgação", exact: true });
  const close = kit.getByRole("button", { name: "Fechar", exact: true });
  const box = await close.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  await close.click();
  await expect(kit).toHaveCount(0);
});
