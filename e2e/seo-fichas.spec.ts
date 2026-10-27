import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";
import { publicPhotoSrc } from "../src/lib/public-photo-url";
import { formatCurrencyBRL } from "../src/lib/format";
import { buildVehicleFullLabel } from "../src/lib/vehicle-display";
import { stockLandingLinks } from "../src/lib/stock-landings";

const origin = "https://www.suagaragem.net";
const sold = { ...samples[0], id: "ce2esold000000000000000001" };

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("fichas têm metadados únicos, foto principal, Vehicle/Offer e navegação indexável", async ({ page, request }) => {
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const car of samples) {
    const path = vehiclePath(car);
    await page.goto(`${path}?utm_source=teste-seo`);
    const title = await page.title();
    const description = (await page.locator('meta[name="description"]').getAttribute("content"))!;
    expect(description).toContain(buildVehicleFullLabel(car));
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toContain(car.brand);
    expect(title).toContain(car.model);
    expect(title).toContain(String(car.yearModel));
    for (const text of [title, description]) {
      expect(text.replace(/\s/g, " ")).toContain(formatCurrencyBRL(car.price).replace(/\s/g, " "));
      expect(text).toContain("seminovo ES");
    }
    titles.add(title);
    descriptions.add(description);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", origin + path);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      await expect(page.locator(selector)).toHaveAttribute("content", origin + publicPhotoSrc(car.photos[0].url));
    }
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", origin + path);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", title);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", description);
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute("content", description);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(raw => JSON.parse(raw));
    const vehicle = schemas.find(schema => schema["@type"] === "Car");
    expect(vehicle.name).toBe(buildVehicleFullLabel(car));
    expect(vehicle.offers).toMatchObject({ "@type": "Offer", price: car.price, priceCurrency: "BRL", availability: "https://schema.org/InStock", url: origin + path });
    expect(vehicle.mileageFromOdometer).toMatchObject({ value: car.km, unitCode: "KMT" });
    expect(vehicle.image[0]).toBe(origin + publicPhotoSrc(car.photos[0].url));
    expect(vehicle).not.toHaveProperty("aggregateRating");
    expect(vehicle).not.toHaveProperty("locationCity");
    const breadcrumbs = schemas.find(schema => schema["@type"] === "BreadcrumbList").itemListElement;
    expect(breadcrumbs.map((item: { position: number }) => item.position)).toEqual([1, 2, 3, 4, 5]);
    expect(breadcrumbs.at(-1).item).toBe(origin + path);
    for (const link of stockLandingLinks([car])) {
      expect(breadcrumbs.some((item: { item: string }) => item.item === origin + link.path)).toBe(true);
      expect((await request.get(link.path)).status()).toBe(200);
    }
    await expect(page.locator('nav[aria-label="Explore marcas, modelos e cidades"]')).toHaveCount(0);
    await expect(page.getByText("Encontre seu próximo seminovo")).toHaveCount(0);
    const photo = page.locator('[data-ficha-page] img').first();
    await expect(photo).toHaveAttribute("alt", `${buildVehicleFullLabel(car)} · ${car.color} - foto 1 de ${car.photos.length}`);
    await expect(page.locator("[data-ficha-page]")).not.toContainText(/Localização do veículo/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(titles.size).toBe(samples.length);
  expect(descriptions.size).toBe(samples.length);
});

test("vendido usa noindex, follow, fica fora do sitemap, preserva canonical e oferece similares sem preço antigo", async ({ page, request }) => {
  const path = vehiclePath(sold);
  await page.goto(path);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", origin + path);
  expect(await page.title()).toContain("(vendido)");
  for (const selector of ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[name="twitter:title"]', 'meta[name="twitter:description"]']) {
    const text = await page.locator(selector).getAttribute("content");
    expect(text).toContain("vendido");
    expect(text).not.toMatch(/R\$|74[.,]?900/);
  }
  const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(raw => JSON.parse(raw));
  const vehicle = schemas.find(schema => schema["@type"] === "Car");
  expect(vehicle.offers.availability).toBe("https://schema.org/OutOfStock");
  expect(JSON.stringify(vehicle)).not.toMatch(/price|74900|R\$/);
  await expect(page.locator('[data-ficha-page] aside')).not.toContainText("R$");
  const similar = page.locator('[data-similar-vehicles] article.listing-card');
  expect(await similar.count()).toBeGreaterThan(0);
  await expect(page.locator('[data-similar-vehicles]')).not.toContainText("Vendido");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain(`<loc>${origin + path}</loc>`);
  const stock = await (await request.get("/api/estoque")).json();
  expect(stock.vehicles.map((car: { id: string }) => car.id)).not.toContain(sold.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
