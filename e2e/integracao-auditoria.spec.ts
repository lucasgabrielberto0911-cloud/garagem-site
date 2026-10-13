import { test, expect } from "@playwright/test";
import { INSTALL_SEEN_AT_KEY } from "../src/lib/pwa-install";

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
});

test("ficha compacta preserva os alvos de toque, o texto de visita e não oferece simulador", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  await page.goto("/estoque");
  const href = await page.locator('article.listing-card a[href^="/estoque/"]').first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.locator("main")).not.toContainText(/simular/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (page.viewportSize()!.width >= 1024) return;
  const bar = page.locator("[data-vehicle-mobile-bar]");
  await expect(bar).toBeVisible();
  expect((await bar.boundingBox())!.height).toBeLessThanOrEqual(98);
  const options = bar.getByRole("button", { name: "Financiamento, troca ou vídeo", exact: true });
  expect((await options.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await bar.locator("#ficha-whatsapp").boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await bar.getByRole("link", { name: "Agendar visita: combinar dia e hora pelo WhatsApp", exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(38);
});

test("atalhos ficam fora da última coluna também em 1024 e 1280 px", async ({ page }) => {
  if (page.viewportSize()!.width < 1024) return;
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const cards = page.locator("article.listing-card");
    await expect(cards.first()).toBeVisible();
    const whatsapp = page.locator(".whatsapp-float");
    await expect(whatsapp).toBeVisible();
    const cardRight = Math.max(...await cards.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().right)));
    const floatBox = (await whatsapp.boundingBox())!;
    expect(cardRight).toBeLessThan(floatBox.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("convite iOS só registra exibição depois de uma decisão de cookies", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 }, hasTouch: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const page = await context.newPage();
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "Consentimento de cookies" })).toBeVisible();
  await page.clock.runFor(15_000);
  await expect(page.locator("[data-install-coach]")).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), INSTALL_SEEN_AT_KEY)).toBeNull();
  await expect(page.locator(".site-chat-launcher")).toBeVisible();
  await page.getByRole("button", { name: "Só o essencial", exact: true }).click();
  await page.clock.runFor(11_000);
  await expect(page.locator("[data-install-coach]")).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), INSTALL_SEEN_AT_KEY)).not.toBeNull();
  await context.close();
});
