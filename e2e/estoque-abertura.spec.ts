import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({
    contentType: "image/png", path: "public/branding/placeholder-car.png",
  }));
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("HTML inicial do /estoque já traz a lista de carros, sem busca nem filtros, mesmo sem JavaScript", async ({ browser, baseURL, page }) => {
  const viewport = page.viewportSize()!;
  const context = await browser.newContext({ javaScriptEnabled: false, viewport });
  try {
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(baseURL!).origin) return route.abort();
      if (url.pathname.includes("/fotos/")) return route.fulfill({
        contentType: "image/png", path: "public/branding/placeholder-car.png",
      });
      return route.continue();
    });
    const initial = await context.newPage();
    await initial.goto(`${baseURL}/estoque`);
    await expect(initial.getByRole("searchbox")).toHaveCount(0);
    await expect(initial.locator("[data-stock-filters]")).toHaveCount(0);
    await expect(initial.locator("article.listing-card")).toHaveCount(3);
  } finally {
    await context.close();
  }
});

test("lista do estoque: todos os cards têm Tenho interesse e não há filtros", async ({ page, request }) => {
  const response = await request.get("/api/estoque");
  expect(response.ok()).toBe(true);
  const stock = await response.json();
  expect(stock.page).toBe(1);
  expect(stock.pageSize).toBe(16);
  await page.goto("/estoque");
  const cards = page.locator("article.listing-card");
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    const interest = card.getByRole("link", { name: /^Tenho interesse em/ });
    await expect(interest).toBeVisible();
    await expect(interest).toHaveText("Tenho interesse");
    await expect(interest).toHaveAttribute("href", /^https:\/\/wa\.me\/5527996330706\?/);
    expect((await interest.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Filtros/ })).toHaveCount(0);
  await expect(page.getByRole("combobox")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("link antigo com filtro não quebra: ignora a query e mostra a lista toda", async ({ page }) => {
  for (const query of ["?brand=Honda&category=carro", "?q=Civic&sort=menor-preco", "?marca=Fiat&maxPrice=1"]) {
    const response = await page.goto(`/estoque${query}`);
    expect(response!.status()).toBe(200);
    await expect(page.locator("article.listing-card")).toHaveCount(3);
    await expect(page.locator("[data-stock-empty]")).toHaveCount(0);
  }
});
