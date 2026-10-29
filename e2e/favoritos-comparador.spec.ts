import { expect, test } from "@playwright/test";

// Dados locais: este percurso não precisa consultar nem popular o banco.
const vehicles = ["Civic", "Duster", "HR-V", "Corolla"].map((model, index) => ({
  id: `c${String(index + 1).repeat(24)}`,
  brand: index === 1 ? "Renault" : "Honda",
  model,
  version: index === 1 ? " " : "Versão de demonstração",
  yearModel: 2020 + index,
  km: index * 10000,
  price: 70000 + index * 10000,
  transmission: index === 1 ? "" : "Automático",
  fuel: "Flex",
  status: "disponivel",
  featured: false,
  createdAt: "2026-01-01",
  photos: [],
}));

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({ path: "public/branding/placeholder-car.png" }));
  await page.route("https://**.supabase.co/**", route => route.abort());
  await page.route("**/api/veiculos?*", route => route.fulfill({ json: { vehicles } }));
  await page.addInitScript(ids => {
    localStorage.setItem("garagem:favoritos", JSON.stringify(ids));
    localStorage.setItem("garagem_consent", "essential");
  }, vehicles.map(vehicle => vehicle.id));
});

for (const width of [320, 360, 390, 430, 1440]) {
  test(`comparação legível, seleção e sessão em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 932 });
    await page.goto("/favoritos");
    await expect(page.getByText("Você já pode comparar seus favoritos lado a lado.")).toBeVisible();
    await page.locator("summary").filter({ hasText: "Comparar favoritos" }).click();
    const region = page.getByRole("region", { name: "Tabela de comparação dos veículos selecionados" });
    await expect(region).toBeVisible();
    await expect(region.getByRole("columnheader")).toHaveCount(3);
    await expect(region.getByRole("rowheader", { name: "Quilometragem", exact: true })).toBeVisible();
    await expect(region.getByRole("row", { name: /^Quilometragem/ })).toContainText("0 km");
    await expect(region.getByText("Não informado", { exact: true })).toHaveCount(2);
    await expect(region).not.toContainText(/Cidade|Consignado/);
    for (const element of await page.locator("fieldset label, details summary, details a, details button").all()) {
      const box = await element.boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
    if (width < 1024) {
      expect(await region.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
      await page.getByRole("group", { name: "Ver colunas da comparação" }).getByRole("button").last().click();
      await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    }
    const checks = page.locator("fieldset input");
    await checks.nth(2).check();
    await expect(checks.nth(3)).toBeDisabled();
    await expect(region.getByRole("columnheader")).toHaveCount(4);
    if (width < 1024) {
      const controls = page.getByRole("group", { name: "Ver colunas da comparação" }).getByRole("button");
      for (const index of [2, 1, 0]) {
        await controls.nth(index).click();
        await expect.poll(() => region.evaluate((el, index) => {
          const fixed = el.querySelector("thead th")!.getBoundingClientRect();
          const column = el.querySelectorAll("thead th")[index + 1].getBoundingClientRect();
          const box = el.getBoundingClientRect();
          return Math.max(fixed.right - column.left, column.right - box.right);
        }, index)).toBeLessThanOrEqual(2);
        const contact = region.getByRole("link", { name: "Tenho interesse", exact: true }).nth(index);
        await contact.scrollIntoViewIfNeeded();
        const fixed = await region.locator("thead th").first().boundingBox();
        const box = await region.boundingBox();
        const cta = await contact.boundingBox();
        expect(cta!.x).toBeGreaterThanOrEqual(fixed!.x + fixed!.width - 2);
        expect(cta!.x + cta!.width).toBeLessThanOrEqual(box!.x + box!.width + 2);
        await expect(contact).toHaveAttribute("href", /^https:\/\/wa\.me\/5527996330706\?/);
        await contact.click({ trial: true });
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await checks.nth(0).uncheck();
    await checks.nth(3).check();
    const order = await region.locator("thead a").allTextContents();
    await page.reload();
    await expect(region).toBeVisible();
    await expect.poll(() => region.locator("thead a").allTextContents()).toEqual(order);
    const links = region.getByRole("link", { name: "Tenho interesse", exact: true });
    await expect(links).toHaveCount(3);
    await expect(links.first()).toHaveAttribute("href", /^https:\/\/wa\.me\/5527996330706\?/);
    await expect(page.getByRole("link", { name: /Pedir vídeo/ })).toHaveCount(0);
  });
}

test("aviso e comparação aparecem somente com dois favoritos disponíveis", async ({ page }) => {
  await page.route("**/api/veiculos?*", route => route.fulfill({ json: { vehicles: vehicles.slice(0, 1) } }));
  await page.goto("/favoritos");
  await expect(page.locator("article.listing-card")).toHaveCount(1);
  await expect(page.getByText("Você já pode comparar seus favoritos lado a lado.")).toHaveCount(0);
  await expect(page.locator("summary").filter({ hasText: "Comparar favoritos" })).toHaveCount(0);
});

test("campos ausentes não viram zero nem diferença numérica", async ({ page }) => {
  await page.route("**/api/veiculos?*", route => route.fulfill({ json: { vehicles: [vehicles[0], {
    ...vehicles[1], price: null, km: null, yearModel: null,
  }] } }));
  await page.goto("/favoritos");
  await page.locator("summary").filter({ hasText: "Comparar favoritos" }).click();
  const table = page.getByRole("table");
  await expect(table.getByText("Não informado", { exact: true })).toHaveCount(5);
  await expect(table.locator("[data-comparison-difference]")).toHaveCount(0);
});
