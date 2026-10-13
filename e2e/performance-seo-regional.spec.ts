import { test, expect } from "@playwright/test";

test.use({ deviceScaleFactor: 3 });

test.beforeEach(async ({ page }) => {
  // Fotos offline; páginas, consultas, sitemap e JSON-LD vêm do app/banco local.
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("São Mateus e Sooretama têm página, canonical, schema e entrada no sitemap", async ({ page, request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  await page.goto("/cidades");
  for (const [slug, name] of [["sao-mateus", "São Mateus"], ["sooretama", "Sooretama"]]) {
    await expect(page.getByRole("link", { name: `Seminovos em ${name}`, exact: true })).toHaveAttribute("href", `/seminovos/${slug}`);
    expect(xml).toContain(`<loc>https://www.suagaragem.net/seminovos/${slug}</loc>`);
  }
  for (const [slug, name] of [["sao-mateus", "São Mateus"], ["sooretama", "Sooretama"]]) {
    const response = await page.goto(`/seminovos/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: `Seminovos em ${name}`, exact: true })).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://www.suagaragem.net/seminovos/${slug}`);
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    const data = schemas.map(raw => JSON.parse(raw));
    const cityPage = data.find(node => node["@type"] === "WebPage");
    expect(cityPage.about.name).toBe(name);
    expect(cityPage.provider.areaServed.name).toBe(name);
    expect(cityPage.provider).not.toHaveProperty("address");
    const business = data.find(node => node["@type"] === "AutoDealer");
    expect(business.areaServed.map((area: { name: string }) => area.name)).toEqual(expect.arrayContaining(["São Mateus", "Sooretama"]));
    expect(business.address.addressLocality).toBe("Linhares");
    expect(business.address.addressRegion).toBe("ES");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("estoque usa logo responsivo e preserva a prioridade da primeira capa", async ({ page }, info) => {
  await page.goto("/estoque");
  const logo = page.locator('header img[alt="Garagem"]').first();
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("srcset", /logo-wordmark-320\.webp 320w/);
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  const selected = await logo.evaluate(async (img: HTMLImageElement) => {
    const decoded = new Image();
    decoded.src = img.currentSrc;
    await decoded.decode();
    return { src: img.currentSrc, width: img.getBoundingClientRect().width, pixels: decoded.naturalWidth, dpr: devicePixelRatio };
  });
  expect(selected.src).toMatch(/logo-wordmark-(320|480|640)\.webp$/);
  expect(selected.width).toBeLessThanOrEqual(196);
  expect(selected.pixels).toBeGreaterThanOrEqual(Math.ceil(selected.width * selected.dpr));
  await expect(page.locator('link[rel="preconnect"][href*="supabase"]')).toHaveCount(0);
  const firstCover = page.locator("article.listing-card img").first();
  await expect(firstCover).toHaveAttribute("fetchpriority", "high");
  await expect(firstCover).toHaveAttribute("loading", "eager");
  await page.screenshot({ path: info.outputPath("estoque-logo-responsivo.png") });
});
