import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({
    contentType: "image/png", path: "public/branding/placeholder-car.png",
  }));
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("HTML inicial oferece busca GET antes dos cards, com placeholder inteiro", async ({ browser, baseURL, page }) => {
  const viewport = page.viewportSize()!;
  const widths = viewport.width === 390 ? [360, 390] : [viewport.width];
  for (const width of widths) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { ...viewport, width } });
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
      const search = initial.getByRole("searchbox", { name: "Buscar por marca, modelo ou versão" });
      await expect(search).toBeVisible();
      await expect(search).toHaveAttribute("name", "q");
      const box = await search.boundingBox();
      const card = await initial.locator("article.listing-card").first().boundingBox();
      expect(width < 1024 ? box!.y + box!.height : box!.y).toBeLessThanOrEqual(card!.y);
      expect(box!.y + box!.height).toBeLessThan(viewport.height);
      const space = await search.evaluate(async (element: HTMLInputElement) => {
        await document.fonts.ready;
        const style = getComputedStyle(element);
        const canvas = document.createElement("canvas").getContext("2d")!;
        canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        return {
          text: canvas.measureText(element.placeholder).width,
          available: element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
        };
      });
      expect(space.text).toBeLessThanOrEqual(space.available);
      await search.fill("Civic");
      await Promise.all([
        initial.waitForURL(/\/estoque\?q=Civic$/),
        search.press("Enter"),
      ]);
    } finally {
      await context.close();
    }
  }
});

test("busca mantém q e ordenação, e todos os cards têm Tenho interesse", async ({ page, request }) => {
  const response = await request.get("/api/estoque");
  expect(response.ok()).toBe(true);
  const stock = await response.json();
  expect(stock.page).toBe(1);
  expect(stock.pageSize).toBe(16);
  await page.goto("/estoque?sort=menor-preco");
  const cards = page.locator("article.listing-card");
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all()) {
    const interest = card.getByRole("link", { name: /^Tenho interesse em/ });
    await expect(interest).toBeVisible();
    await expect(interest).toHaveText("Tenho interesse");
    await expect(interest).toHaveAttribute("href", /^https:\/\/wa\.me\/5527996330706\?/);
    expect((await interest.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  const search = page.getByRole("searchbox", { name: "Buscar por marca, modelo ou versão" });
  await search.fill("Civic");
  await expect(page).toHaveURL(/q=Civic/);
  await expect(page).toHaveURL(/sort=menor-preco/);
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Civic");
  await search.fill("");
  await search.press("Enter");
  await expect(page).not.toHaveURL(/q=/);
  await expect(cards).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("digitação antes da hidratação permanece quando os filtros são ativados", async ({ page }) => {
  let liberarScripts!: () => void;
  const scriptsLiberados = new Promise<void>(resolve => { liberarScripts = resolve; });
  await page.route("**/_next/**/*.js", async route => {
    await scriptsLiberados;
    await route.continue();
  });
  try {
    await page.goto("/estoque?sort=menor-preco", { waitUntil: "commit" });
    const search = page.getByRole("searchbox", { name: "Buscar por marca, modelo ou versão" });
    await search.fill("Civic");
    liberarScripts();
    await expect(page.getByRole("button", { name: "Limpar filtros", exact: true })).toBeVisible();
    await expect(search).toHaveValue("Civic");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=Civic/);
    await expect(page).toHaveURL(/sort=menor-preco/);
    await expect(page.locator("article.listing-card")).toHaveCount(1);
  } finally {
    liberarScripts();
  }
});

test("celular mantém atalhos e gaveta com 44 px e remove filtros individualmente", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, "gaveta exclusiva do celular");
  await page.goto("/estoque");
  const filters = page.locator('button[aria-controls="painel-filtros"]');
  await expect(filters).toHaveText("Filtros");
  const cars = page.getByRole("button", { name: "Carros", exact: true });
  for (const control of [filters, cars]) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await cars.click();
  await expect(page).toHaveURL(/category=carro/);
  await filters.click();
  const drawer = page.getByRole("dialog", { name: "Filtrar veículos" });
  await drawer.getByLabel("Marca", { exact: true }).selectOption("Honda");
  await drawer.getByRole("button", { name: /^Ver (\d+ )?veículos$/ }).click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/brand=Honda/);
  await expect(page.locator("article.listing-card")).toHaveCount(2);
  const active = page.getByRole("region", { name: "Filtros ativos", exact: true });
  const removeBrand = active.getByRole("button", { name: "Remover Marca: Honda", exact: true });
  expect((await removeBrand.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await removeBrand.click();
  await expect(page).not.toHaveURL(/brand=/);
  await expect(page).toHaveURL(/category=carro/);
  await active.getByRole("button", { name: "Remover Tipo: Carro", exact: true }).click();
  await expect(active).toBeHidden();
  await expect(page.locator("article.listing-card")).toHaveCount(3);
});
