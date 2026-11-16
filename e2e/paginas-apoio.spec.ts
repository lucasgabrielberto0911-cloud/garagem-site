import { test, expect, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", (route) =>
    route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }),
  );
  await page.addInitScript(() => {
    if (!localStorage.getItem("garagem_consent")) localStorage.setItem("garagem_consent", "essential");
  });
});

async function semOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("/como-funciona: etapas, canonical, breadcrumb e sem overflow", async ({ page }) => {
  const res = await page.goto("/como-funciona");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vistoria e procedência" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entrega combinada" })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.suagaragem.net/como-funciona");
  expect(await page.locator('script[type="application/ld+json"]').allTextContents()).toEqual(
    expect.arrayContaining([expect.stringContaining("BreadcrumbList")]),
  );
  await expect(page.locator('main a[href*="wa.me"]').first()).toBeVisible();
  await semOverflow(page);
});

test("/financiamento: 60x, 18x, WhatsApp e link para /vender", async ({ page }) => {
  const res = await page.goto("/financiamento");
  expect(res?.status()).toBe(200);
  const main = page.locator("main");
  await expect(main).toContainText("até 60x");
  await expect(main).toContainText("até 18x");
  await expect(main).toContainText("análise de crédito");
  await expect(main.getByRole("link", { name: "Vender ou trocar" })).toHaveAttribute("href", "/vender");
  await expect(main.locator('a[href*="wa.me"]').first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.suagaragem.net/financiamento");
  await semOverflow(page);
});

test("links discretos: home e sobre apontam para /vendidos; rodapé lista as páginas de apoio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Ver entregas e veículos vendidos/ })).toHaveAttribute("href", "/vendidos");
  await semOverflow(page);
  await page.goto("/sobre");
  await expect(page.locator('main a[href="/vendidos"]').first()).toHaveAttribute("href", "/vendidos");
  await semOverflow(page);
  const footer = page.locator("footer");
  for (const href of ["/como-funciona", "/financiamento", "/vendidos"]) {
    await expect(footer.locator(`a[href="${href}"]`).first()).toBeAttached();
  }
});

test("sitemap inclui as páginas de apoio", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/como-funciona", "/financiamento", "/vendidos"]) expect(xml).toContain(`www.suagaragem.net${path}<`);
});

test("orçamento mobile de JS: páginas de apoio até 220 KiB", async ({ page }, info) => {
  test.skip(info.project.name === "desktop", "orçamento é mobile");
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1" ? route.fallback() : route.abort(),
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  let bytes = 0;
  const scripts = new Set<string>();
  cdp.on("Network.responseReceived", (r) => { if (r.type === "Script") scripts.add(r.requestId); });
  cdp.on("Network.loadingFinished", (r) => { if (scripts.has(r.requestId)) bytes += r.encodedDataLength; });
  for (const route of ["/como-funciona", "/financiamento"]) {
    bytes = 0; scripts.clear();
    await page.goto(route, { waitUntil: "load" });
    expect(bytes, `${route}: scripts medidos`).toBeGreaterThan(0);
    expect(bytes, `${route}: JS até load`).toBeLessThanOrEqual(220 * 1024);
  }
});
