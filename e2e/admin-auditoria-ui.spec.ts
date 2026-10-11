import { test, expect, type Page } from "@playwright/test";

/**
 * Regressão de UI do painel (Frente A da auditoria). Precisa do banco local com o
 * seed do admin (`npx tsx /workspace/admin-pacote/tools/seed-local.ts`); sem o
 * usuário de teste o arquivo inteiro é ignorado.
 */
const email = process.env.AUDIT_EMAIL ?? "audit@local.test";
const password = process.env.AUDIT_PASSWORD ?? "audit-local-123";

async function login(page: Page) {
  const response = await page.request.post("/api/auth/login", {
    data: { email, password },
    headers: { Origin: String(test.info().project.use.baseURL) },
  });
  test.skip(!response.ok(), "Usuário de teste do admin não existe neste banco.");
}

test.beforeEach(async ({ page }) => {
  await login(page);
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 1024;

test("leads: card fechado compacto, ações no detalhe e WhatsApp à mão", async ({ page }) => {
  await page.goto("/admin/leads");
  const cards = page.locator("li[id^='lead-']");
  await expect(cards.first()).toBeVisible();
  const first = cards.first();
  if (isMobile(page)) {
    const box = await first.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(260);
  }
  const toggle = first.getByRole("button", { name: /Detalhes/ });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(first.getByLabel("Status do lead")).toHaveCount(0);
  await toggle.click();
  await expect(first.getByLabel("Status do lead")).toBeVisible();
  await expect(first.getByRole("button", { name: "Excluir lead" })).toBeVisible();
  await expect(first.getByRole("button", { name: /Virar cliente/ })).toBeVisible();
  const box = await first.getByRole("button", { name: "Excluir lead" }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("depoimentos: sem rolagem lateral no celular", async ({ page }) => {
  await page.goto("/admin/depoimentos");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("veículos: seleção do card tem alvo de 44 px no celular", async ({ page }) => {
  test.skip(!isMobile(page), "Alvo de toque só importa no celular.");
  await page.goto("/admin/veiculos");
  const label = page.locator("li label:visible", { has: page.locator("input[type=checkbox]") }).first();
  const box = await label.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test("clientes: Voltar do navegador pergunta antes de descartar o formulário", async ({ page }) => {
  await page.goto("/admin");
  await page.goto("/admin/clientes");
  await page.getByRole("button", { name: "Novo cliente", exact: true }).first().click();
  await page.getByLabel(/Nome/).first().fill("Cliente Rascunho");
  const messages: string[] = [];
  let accept = false;
  page.on("dialog", (dialog) => {
    messages.push(dialog.message());
    void (accept ? dialog.accept() : dialog.dismiss());
  });
  await page.goBack();
  await expect.poll(() => messages.length).toBeGreaterThan(0);
  await expect(page).toHaveURL(/\/admin\/clientes/);
  await expect(page.getByLabel(/Nome/).first()).toHaveValue("Cliente Rascunho");
  accept = true;
  await page.goBack();
  await expect(page).toHaveURL(/\/admin$/);
});

test("fotos: o campo photoUrls leva o id de cada foto", async ({ page }) => {
  await page.goto("/admin/veiculos");
  const href = await page.locator("a[href^='/admin/veiculos/c']").first().getAttribute("href");
  await page.goto(href!);
  const raw = await page.locator("input[name=photoUrls]").inputValue();
  const photos = JSON.parse(raw) as Array<{ id?: string; url: string }>;
  expect(photos.length).toBeGreaterThan(0);
  for (const photo of photos) expect(photo.id).toBeTruthy();
});
