import { test as base, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

const civic = samples[0];
const path = vehiclePath(civic);
const test = base.extend<{ browserErrors: string[] }>({
  browserErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", msg => { if (msg.type() === "error" && /hydration|React error|did not match/i.test(msg.text())) errors.push(msg.text()); });
    // Fotos são fixtures offline; navegação, API, SSR e consultas usam o app/banco reais.
    const image = readFileSync("public/branding/placeholder-car.png");
    await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", body: image }));
    await use(errors);
    expect(errors, "Erros de JS/hidratação no percurso").toEqual([]);
  }, { auto: true }],
});

test("404 real, aliases 308 e vendido sem preço no HTML/JSON-LD", async ({ request, page }) => {
  const canonical = await request.get(path); expect(canonical.status()).toBe(200);
  for (const alias of [`/estoque/${civic.id}`, `/estoque/nome-antigo-${civic.id}`]) {
    const response = await request.get(alias, { maxRedirects: 0 });
    expect(response.status()).toBe(308); expect(response.headers().location.split(", ").every(value => value === path)).toBe(true);
  }
  for (const userAgent of ["Mozilla/5.0", "Googlebot"]) {
    expect((await request.get("/estoque/ce2emissing000000000000001", { headers: { "User-Agent": userAgent } })).status()).toBe(404);
  }
  await page.goto(vehiclePath({ ...civic, id: "ce2esold000000000000000001" }));
  await expect(page.getByRole("heading", { name: /Civic/i }).first()).toBeVisible();
  await expect(page.locator("[data-ficha-page] aside")).not.toContainText("74.900");
  await expect(page.locator("[data-ficha-page] aside")).toContainText("Já vendido");
  await expect(page.locator(".ficha-mobile-fold")).not.toContainText("74.900");
  await expect(page.getByText("Este veículo já foi vendido", { exact: true })).toBeVisible();
  const schema = await page.locator('script[type="application/ld+json"]').allTextContents();
  for (const raw of schema) {
    const parsed = JSON.parse(raw);
    const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] ?? [parsed];
    for (const node of nodes) if (node.offers) expect(node.offers).not.toHaveProperty("price");
  }
});

test("card, ficha, voltar, favoritos e WhatsApp oficial", async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.goto("/estoque?sort=menor-preco");
  const cards = page.locator("article.listing-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toBeVisible(); await expect(cards.nth(1)).toBeVisible();
  const [a, b] = await cards.evaluateAll(elements => elements.slice(0, 2).map(element => {
    const rect = element.getBoundingClientRect(); return { y: rect.y, height: rect.height };
  }));
  if (info.project.name.startsWith("mobile")) {
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    expect(Math.abs(a.height - b.height)).toBeLessThan(2);
    const nav = page.locator("[data-mobile-bottom-nav]"); await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox(); expect(navBox!.y + navBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
    await expect(page.getByRole("button", { name: "Ajuda para escolher", exact: true }).first()).toBeVisible();
  }
  const card = cards.filter({ has: page.getByRole("heading", { name: "Civic", exact: true }) });
  await expect(card).toContainText("LXR 2.0 FlexOne"); await expect(card).toContainText("2015"); await expect(card).toContainText("74.900");
  await expect(card.locator(".listing-card-interest a")).toHaveAttribute("href", /^https:\/\/wa\.me\/5527996330706\?/);
  await expect(card).not.toContainText(/Linhares|Serra|Aracruz|Vitória/);
  const payload = await (await page.request.get("/api/estoque?city=serra")).json();
  expect(JSON.stringify(payload)).not.toContain("locationCity");
  await card.getByRole("button", { name: /^Salvar/ }).click();
  await card.locator("[data-stock-card]").click(); await expect(page).toHaveURL(new RegExp(civic.id));
  await page.getByRole("link", { name: "Voltar aos resultados" }).click(); await expect(page).toHaveURL(/sort=menor-preco/);
  const duster = page.locator("article.listing-card").filter({ has: page.getByRole("heading", { name: "Duster", exact: true }) });
  await duster.getByRole("button", { name: /^Salvar/ }).click();
  const hrv = page.locator("article.listing-card").filter({ has: page.getByRole("heading", { name: "HR-V", exact: true }) });
  await hrv.getByRole("button", { name: /^Salvar/ }).click();
  await page.goto("/favoritos"); await expect(page.locator("article.listing-card")).toHaveCount(3);
  await page.getByText("Comparar favoritos", { exact: false }).click();
  const checks = page.locator("fieldset input[type=checkbox]");
  await expect(checks).toHaveCount(3);
  if (!(await checks.last().isChecked())) await checks.last().check();
  await expect(page.getByRole("table")).toBeVisible(); await expect(page.getByRole("table")).toContainText("LXR 2.0 FlexOne");
  await expect(page.getByRole("table")).not.toContainText("Cidade");
  if (info.project.name.startsWith("mobile")) {
    const region = page.getByRole("region", { name: "Tabela de comparação dos veículos selecionados" });
    await page.getByRole("group", { name: "Ver colunas da comparação" }).getByRole("button").last().click();
    await expect.poll(async () => {
      const last = await region.locator("thead th").last().boundingBox();
      const box = await region.boundingBox();
      return last!.x + last!.width - box!.x - box!.width;
    }).toBeLessThanOrEqual(2);
    const contact = region.getByRole("link", { name: "Tenho interesse", exact: true }).last();
    await contact.scrollIntoViewIfNeeded();
    const contactBox = await contact.boundingBox();
    const navBox = await page.locator("[data-mobile-bottom-nav]").boundingBox();
    expect(contactBox!.y + contactBox!.height).toBeLessThanOrEqual(navBox!.y);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const wa = page.getByRole("table").getByRole("link", { name: "Tenho interesse", exact: true });
  await expect(wa.first()).toHaveAttribute("href", /^https:\/\/wa\.me\/5527996330706\?/);
});

test("busca tolerante encontra o Civic e mantém ordenação", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.goto("/estoque?sort=menor-preco");
  await page.getByRole("searchbox", { name: "Buscar por marca, modelo ou versão" }).fill("civc");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/q=civc/); await expect(page).toHaveURL(/sort=menor-preco/);
  await page.getByRole("link", { name: /^Civic 1 veículo$/ }).click();
  await expect(page).toHaveURL(/q=Civic/); await expect(page).toHaveURL(/sort=menor-preco/);
  await expect(page.locator("article.listing-card")).toHaveCount(1);
  await expect(page.locator("article.listing-card")).toContainText("Civic");
});

test("pergunta de potência responde o dado com fontes antes do card e WhatsApp oficial", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.goto("/estoque");
  await page.getByRole("button", { name: "Ajuda para escolher", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Sua Garagem", exact: true });
  await dialog.locator("textarea").fill("quantos cv tem a duster?");
  await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(dialog).toHaveAttribute("aria-busy", "false");
  const answer = dialog.locator('[data-chat-latest="1"]');
  await expect(answer).toContainText("142 cv com etanol e 138 cv com gasolina");
  await expect(answer).not.toContainText("qual é o mais potente");
  await expect(answer.locator("[data-chat-vehicle]")).toHaveCount(1);
  const sources = answer.getByRole("region", { name: "Pesquisa técnica e fontes" });
  await expect(sources).toContainText("Renault");
  await expect(sources).toContainText("AutoPapo");
  expect(await sources.evaluate(element => Boolean(element.compareDocumentPosition(element.parentElement!.querySelector("[data-chat-vehicle]")!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await expect(answer.getByRole("link", { name: /^Tenho interesse/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/5527996330706\?/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Nova conversa", exact: true }).click();
  await dialog.locator("textarea").fill("quantos cv tem a Duster ano 2014?");
  await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(dialog).toHaveAttribute("aria-busy", "false");
  await expect(dialog.locator('[data-chat-latest="1"]')).toContainText("142 cv com etanol e 138 cv com gasolina");
  await dialog.getByRole("button", { name: "Nova conversa", exact: true }).click();
  await dialog.locator("textarea").fill("quantos cv tem a Duster 1.6?");
  await dialog.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(dialog).toHaveAttribute("aria-busy", "false");
  const mismatched = dialog.locator('[data-chat-latest="1"]');
  await expect(mismatched).toContainText("versão e o ano completos");
  await expect(mismatched).not.toContainText(/142 cv|138 cv/);
  await expect(mismatched.locator("[data-chat-vehicle]")).toHaveCount(0);
});

test("cookies na primeira visita e nas visitas com aceite salvo, sem hidratação quebrada", async ({ page }) => {
  await page.goto(path);
  await expect(page.getByRole("dialog", { name: "Consentimento de cookies" })).toBeVisible();
  await page.getByRole("button", { name: "Só o essencial", exact: true }).click();
  await page.reload(); await expect(page.getByRole("dialog", { name: "Consentimento de cookies" })).toBeHidden();
  await page.evaluate(() => localStorage.setItem("garagem_consent", "accepted"));
  await page.reload(); await expect(page.getByRole("dialog", { name: "Consentimento de cookies" })).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-consent", "accepted");
});
