import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

test.use({ deviceScaleFactor: 3 });
test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("ficha disponível e vendida têm um H1 acessível em qualquer viewport", async ({ page }) => {
  for (const vehicle of [samples[0], { ...samples[0], id: "ce2esold000000000000000001" }]) {
    await page.goto(vehiclePath(vehicle));
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Civic/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("cidades tem redirect 301, destino canônico e nenhum link ou sitemap na URL antiga", async ({ page, request }) => {
  const redirect = await request.get("/cidades?origem=rodape", { maxRedirects: 0 });
  expect(redirect.status()).toBe(301);
  expect(redirect.headers().location).toBe("/seminovos?origem=rodape");
  await page.goto("/cidades");
  await expect(page).toHaveURL(/\/seminovos$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://www.suagaragem.net/seminovos");
  await expect(page.locator('a[href="/cidades"]')).toHaveCount(0);
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).not.toContain("/cidades</loc>");
  expect(xml.match(/<loc>https:\/\/www\.suagaragem\.net\/seminovos<\/loc>/g)).toHaveLength(1);
});

test("as duas primeiras capas têm prioridade alta e as demais ficam lazy", async ({ page }) => {
  for (const path of ["/", "/estoque"]) {
    await page.goto(path);
    const covers = page.locator("article.listing-card img");
    await expect(covers.first()).toHaveAttribute("fetchpriority", "high");
    await expect(covers.first()).toHaveAttribute("loading", "eager");
    await expect(covers.nth(1)).toHaveAttribute("fetchpriority", "high");
    await expect(covers.nth(1)).toHaveAttribute("loading", "eager");
    await expect(page.locator('article.listing-card img[fetchpriority="high"]')).toHaveCount(2);
    if (page.viewportSize()!.width < 640) {
      const source = page.locator('article.listing-card source[media="(max-width: 639px)"]').first();
      await expect(source).toHaveAttribute("srcset", /480w$/);
      await expect(source).not.toHaveAttribute("srcset", /720w|960w/);
      await expect.poll(() => covers.first().evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/-card\.webp|480x360/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
