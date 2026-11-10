import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const db = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
if (process.env.E2E_TEST !== "1" || !["localhost", "127.0.0.1", "[::1]"].includes(db.hostname) || !["/ci", "/garagem_e2e"].includes(db.pathname)) throw new Error("IA E2E exige banco local dedicado.");
const mocked = process.env.E2E_ADMIN_AI_MOCK === "1";
const prisma = new PrismaClient();
const test = base.extend<{ vehicleId: string }>({
  vehicleId: async ({ page, context, baseURL }, executar) => {
    const email = `ia-${randomUUID()}@local.test`, password = "ia-ficticia-local-123";
    const admin = await prisma.admin.create({ data: { name: "Operador fictício", email, passwordHash: await bcrypt.hash(password, 4) } });
    const vehicle = await prisma.vehicle.create({ data: { brand: "Honda", model: "Civic", version: "EXL 2.0", year: 2018, yearModel: 2019, km: 50000, price: 95000, fuel: "Flex", transmission: "CVT", description: "Otmo veículo. Aceita troca após avaliação.", accessories: ["Conforto: Ar-condicionado"] } });
    try {
      page.on("dialog", dialog => dialog.accept());
      await context.route(/\/fotos\/|\/api\/fotos\/|supabase\.co\/storage\//, route => route.fulfill({ path: "public/branding/placeholder-car.png", contentType: "image/png" }));
      await context.route(/^https?:\/\/(?!127\.0\.0\.1[:/]|localhost[:/])/, route => route.abort());
      await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
      await page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}` });
      const response = await page.request.post("/api/auth/login", { data: { email, password } }); expect(response.ok()).toBeTruthy();
      const cookie = response.headers()["set-cookie"].split(";")[0];
      await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax", secure: false }]);
      await executar(vehicle.id);
    } finally {
      await prisma.adminDraft.deleteMany({ where: { adminId: admin.id } });
      await prisma.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await prisma.vehicle.delete({ where: { id: vehicle.id } });
      await prisma.admin.delete({ where: { id: admin.id } });
    }
  },
});
test.afterAll(async () => prisma.$disconnect());

async function openLegend(page: Page, vehicleId: string) {
  await page.goto(`/admin/veiculos/${vehicleId}`);
  // A primeira abertura pode entregar HTML antes de hidratar a navegação existente.
  await expect(async () => {
    await page.getByRole("button", { name: /3.*Preço/ }).click();
    await expect(page.getByLabel("Colar legenda", { exact: true })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}
const reviewGroup = (page: Page) => page.getByRole("group", { name: "Sugestões de IA" });

test("revisão e melhoria da legenda exigem aprovação local, preservam ficha e não salvam", async ({ page, vehicleId }) => {
  test.skip(!mocked, "Requer provedor mockado.");
  const before = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
  await openLegend(page, vehicleId);
  const field = page.getByLabel("Colar legenda", { exact: true }), group = reviewGroup(page);
  const original = await field.inputValue();
  await group.getByRole("button", { name: "Revisar português", exact: true }).click();
  await expect(group.getByText("Original × proposta")).toBeVisible();
  await expect(field).toHaveValue(original);
  await group.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(field).toHaveValue(original);
  await group.getByRole("button", { name: "Revisar português", exact: true }).click();
  await group.getByRole("checkbox").uncheck();
  await expect(group.getByRole("button", { name: "Aplicar sugestões selecionadas" })).toBeDisabled();
  await group.getByRole("checkbox").check();
  await group.getByRole("button", { name: "Aplicar sugestões selecionadas" }).click();
  await expect(field).toHaveValue(original.replace("Otmo", "Ótimo"));
  await group.getByRole("button", { name: "Melhorar legenda", exact: true }).click();
  await expect(group.getByText("Original × proposta")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("legenda-proposta.png"), fullPage: true });
  await group.getByRole("button", { name: "Aplicar sugestões selecionadas" }).click();
  const improved = await field.inputValue();
  for (const value of ["Honda Civic EXL 2.0", "2018", "2019", "50.000", "95.000,00", "Ar-condicionado", "Aceita troca após avaliação."]) expect(improved).toContain(value);
  await field.fill("Teste de equipamento inventado.");
  await group.getByRole("button", { name: "Melhorar legenda", exact: true }).click();
  await expect(group.getByRole("status")).toContainText("Proposta bloqueada");
  await expect(group.getByRole("button", { name: "Aplicar sugestões selecionadas" })).toHaveCount(0);
  await expect(field).toHaveValue("Teste de equipamento inventado.");
  expect(await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("legenda-ia.png"), fullPage: true });
});

test("resultado atrasado e proposta já recebida são descartados quando o texto muda", async ({ page, vehicleId }) => {
  test.skip(!mocked, "Requer provedor mockado.");
  await openLegend(page, vehicleId);
  const field = page.getByLabel("Colar legenda", { exact: true }), group = reviewGroup(page);
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/admin/ia/revisar-texto", async route => {
    const response = await route.fetch();
    await wait;
    await route.fulfill({ response });
  });
  const requested = page.waitForRequest("**/api/admin/ia/revisar-texto");
  await group.getByRole("button", { name: "Revisar português", exact: true }).click();
  await requested;
  await field.fill("Otmo texto alterado durante a consulta.");
  release();
  await expect(group.getByText(/Resultado descartado/)).toBeVisible();
  await expect(group.getByRole("button", { name: "Aplicar sugestões selecionadas" })).toHaveCount(0);
  await page.unroute("**/api/admin/ia/revisar-texto");
  await group.getByRole("button", { name: "Revisar português", exact: true }).click();
  await expect(group.getByText("Original × proposta")).toBeVisible();
  await field.fill("Outro texto.");
  await field.fill("Otmo texto alterado durante a consulta.");
  await expect(group.getByRole("button", { name: "Aplicar sugestões selecionadas" })).toHaveCount(0);
});

test("revisão no site, FAQ e links altera só o formulário", async ({ page, vehicleId }) => {
  test.skip(!mocked, "Requer provedor mockado.");
  expect(vehicleId).toBeTruthy();
  const before = await prisma.siteSettings.findUnique({ where: { id: "default" } });
  await page.goto("/admin/site");
  const address = page.getByLabel("Endereço / modalidade", { exact: false });
  await address.fill("Otmo atendimento online.");
  const area = address.locator("..");
  await area.getByRole("button", { name: "Revisar português", exact: true }).click();
  await area.getByRole("button", { name: "Aplicar sugestões selecionadas" }).click();
  await expect(address).toHaveValue("Ótimo atendimento online.");
  await page.locator("summary").filter({ hasText: "Dúvidas frequentes" }).click();
  const answer = page.getByLabel("Resposta", { exact: true }).first();
  await answer.fill("Otmo prazo para responder.");
  const answerArea = answer.locator("..");
  await answerArea.getByRole("button", { name: "Revisar português", exact: true }).click();
  await answerArea.getByRole("button", { name: "Descartar", exact: true }).click();
  await expect(answer).toHaveValue("Otmo prazo para responder.");
  const link = page.getByLabel("Rótulo", { exact: true }).first();
  await link.fill("Otmo estoque");
  const linkArea = link.locator("..");
  await linkArea.getByRole("button", { name: "Revisar português", exact: true }).click();
  await linkArea.getByRole("button", { name: "Aplicar sugestões selecionadas" }).click();
  await expect(link).toHaveValue("Ótimo estoque");
  expect(await prisma.siteSettings.findUnique({ where: { id: "default" } })).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("site-ia.png"), fullPage: true });
});

test("ajuda consulta apenas o guia e não executa ações", async ({ page, vehicleId }) => {
  test.skip(!mocked, "Requer provedor mockado.");
  const before = await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } });
  await page.goto("/admin/ajuda");
  await expect(page.getByRole("heading", { name: "Ajuda do painel" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByLabel("Sua dúvida sobre o painel").fill("Como cadastrar um veículo?");
  await page.getByRole("button", { name: "Perguntar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Abra Veículos" })).toBeVisible();
  expect(await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("ajuda-ia.png"), fullPage: true });
});

test("sem chave as três telas avisam e os formulários continuam editáveis", async ({ page, vehicleId, baseURL }) => {
  test.skip(mocked || Boolean(process.env.ADMIN_AI_NVIDIA_API_KEY), "Rodar também sem chave e sem mock.");
  await openLegend(page, vehicleId);
  const group = reviewGroup(page), field = page.getByLabel("Colar legenda", { exact: true });
  for (const name of ["Revisar português", "Melhorar legenda"]) {
    await group.getByRole("button", { name, exact: true }).click();
    await expect(group.getByRole("status")).toContainText("IA indisponível no momento");
  }
  await field.fill("Texto continua editável.");
  await expect(field).toHaveValue("Texto continua editável.");
  await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
  const response = await page.request.post("/api/admin/ia/ajuda-painel", { headers: { Origin: baseURL! }, data: { question: "Como usar?" } });
  expect(response.status()).toBe(503);
  await page.goto("/admin/site");
  const address = page.getByLabel("Endereço / modalidade", { exact: false });
  await address.fill("Otmo atendimento.");
  await address.locator("..").getByRole("button", { name: "Revisar português", exact: true }).click();
  await expect(address.locator("..").getByRole("status")).toContainText("IA indisponível no momento");
  await expect(address).toBeEditable();
  await expect(page.getByRole("button", { name: "Salvar dados do site", exact: true })).toBeEnabled();
  await page.goto("/admin/ajuda");
  await page.getByLabel("Sua dúvida sobre o painel").fill("Como cadastrar?");
  await page.getByRole("button", { name: "Perguntar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "IA indisponível no momento" })).toBeVisible();
});

test("API e ajuda exigem sessão de admin", async ({ page, baseURL }) => {
  const response = await page.request.post("/api/admin/ia/revisar-texto", { headers: { Origin: baseURL! }, data: { text: "Otmo" } });
  expect(response.status()).toBe(401);
  await page.goto("/admin/ajuda");
  await expect(page).toHaveURL(/\/admin\/login/);
});
