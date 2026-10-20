import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("busca vem antes dos cards, envia GET sem JavaScript e encontra o modelo", async ({ browser, baseURL, page }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: page.viewportSize()! });
  try {
    await context.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
    const home = await context.newPage();
    await home.goto("/");
    const search = home.locator(".hero-search").getByRole("search");
    const firstCard = home.locator("article.listing-card").first();
    const searchBox = await search.boundingBox();
    const cardBox = await firstCard.boundingBox();
    expect(searchBox!.y + searchBox!.height).toBeLessThanOrEqual(cardBox!.y);
    await search.getByRole("searchbox", { name: "Buscar por marca ou modelo" }).fill("Civic");
    await Promise.all([
      home.waitForURL(/\/estoque\?q=Civic/, { waitUntil: "commit" }),
      search.getByRole("searchbox", { name: "Buscar por marca ou modelo" }).press("Enter", { noWaitAfter: true }),
    ]);
  } finally {
    await context.close();
  }
  await page.goto("/");
  await page.locator(".hero-search").getByRole("searchbox", { name: "Buscar por marca ou modelo" }).fill("Civic");
  await page.locator(".hero-search").getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/\/estoque\?q=Civic/);
  await expect(page.locator("article.listing-card")).not.toHaveCount(0);
  await expect(page.locator("article.listing-card").first()).toContainText(/Civic/i);
  await expect(page.locator('article.listing-card a[href*="wa.me"]').first()).toBeVisible();
});

test("home mantém depoimentos, FAQ e região sem selo Google", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Quem compra, indica" })).toBeVisible();
  await expect(page.locator("blockquote").first()).toBeAttached();
  await expect(page.locator("details").first()).toBeAttached();
  await expect(page.getByRole("heading", { name: "Loja digital no Espírito Santo" })).toBeVisible();
  await expect(page.getByText(/avaliaç(?:ão|ões) no Google/)).toHaveCount(0);
  const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll(scripts =>
    scripts.map(script => JSON.parse(script.textContent || "{}")),
  );
  expect(schemas.find(schema => schema["@type"] === "AutoDealer" && schema.review?.length > 0)?.sameAs).toContain("https://maps.google.com/?cid=1234567890");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("capa da ficha baixa só a variante escolhida pelo navegador", async ({ browser, baseURL, page }) => {
  // DPR 4 força 1280w no celular de 430px: o preload fixo de 800 era redundante.
  const context = await browser.newContext({ baseURL, viewport: page.viewportSize()!, deviceScaleFactor: 4 });
  try {
    const requests: string[] = [];
    await context.route("**/fotos/**", route => {
      requests.push(route.request().url());
      return route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" });
    });
    const ficha = await context.newPage();
    await ficha.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
    await ficha.goto(vehiclePath(samples[0]));
    const cover = ficha.locator(".gallery-frame img").first();
    await expect(cover).toBeVisible();
    await expect.poll(() => cover.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const src = await cover.evaluate((img: HTMLImageElement) => img.currentSrc);
    const original = src.split("/").pop()!;
    const coverRequests = requests.filter(url => url.split("/").pop() === original);
    expect([...new Set(coverRequests)]).toEqual([src]);
    await expect(cover).toHaveAttribute("fetchpriority", "high");
    await expect(cover).toHaveAttribute("loading", "eager");
  } finally {
    await context.close();
  }
});
