import { expect, test } from "@playwright/test";
import { stubPageFotos } from "./stub-fotos";

test("galeria /vendidos exibe título, fotos 4:5 com selo VENDIDO, 24 iniciais, +24 em Ver mais, 4 colunas no desktop e 2 no mobile", async ({
  page,
  request,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("garagem_consent", "essential"),
  );
  await stubPageFotos(page);

  const response = await request.get("/vendidos");
  expect(response.status()).toBe(200);

  await page.goto("/vendidos");
  await expect(
    page.getByRole("heading", { level: 1, name: "Vendidos" }),
  ).toBeVisible();
  await expect(
    page.getByText("Clientes que já saíram de carro novo da Garagem"),
  ).toBeVisible();

  const grid = page.locator("[data-insta-deliveries-grid]");
  await expect(grid).toBeVisible();

  const items = grid.locator("> li");
  await expect(items).toHaveCount(24);

  await expect(grid.locator("a")).toHaveCount(0);
  await expect(page.locator('main a[href*="instagram.com"]')).toHaveCount(0);

  await expect(items.nth(0).locator("img")).toHaveAttribute("loading", "eager");
  await expect(items.nth(0).locator("img")).toHaveAttribute(
    "fetchpriority",
    "high",
  );
  await expect(items.nth(3).locator("img")).toHaveAttribute("loading", "eager");
  await expect(items.nth(4).locator("img")).toHaveAttribute("loading", "lazy");
  await expect(items.first().locator("img")).toHaveAttribute(
    "alt",
    /entregue a cliente da Sua Garagem$/,
  );

  const badges = items.locator("[data-sold-badge]");
  await expect(badges).toHaveCount(24);
  for (let i = 0; i < 4; i++) {
    await expect(badges.nth(i)).toBeVisible();
    await expect(badges.nth(i)).toHaveText("VENDIDO");
  }

  const ratios = await items.locator("img").evaluateAll((imgs) =>
    imgs.slice(0, 8).map((img) => {
      const rect = img.getBoundingClientRect();
      return rect.height > 0 ? rect.width / rect.height : 0;
    }),
  );
  for (const ratio of ratios) {
    expect(ratio).toBeGreaterThan(0.75);
    expect(ratio).toBeLessThan(0.85);
  }

  const titles = await items.locator("[data-delivery-title]").allInnerTexts();
  expect(titles).toHaveLength(24);
  for (const title of titles) {
    expect(title.trim().length).toBeGreaterThan(0);
  }

  const viewportWidth = page.viewportSize()?.width ?? 1440;
  const expectedCols = viewportWidth >= 1024 ? 4 : 2;
  const tops = await items.evaluateAll((els) =>
    els.slice(0, 6).map((el) => Math.round(el.getBoundingClientRect().top)),
  );
  for (let i = 1; i < expectedCols; i++) {
    expect(Math.abs(tops[i] - tops[0])).toBeLessThanOrEqual(2);
  }
  expect(tops[expectedCols]).toBeGreaterThan(tops[0] + 20);

  const loadMoreBtn = page.getByRole("button", { name: "Ver mais" });
  await expect(loadMoreBtn).toBeVisible();
  const btnHeight = await loadMoreBtn.evaluate(
    (el) => el.getBoundingClientRect().height,
  );
  expect(btnHeight).toBeGreaterThanOrEqual(56);

  await loadMoreBtn.click();
  await expect(items).toHaveCount(48);

  if (viewportWidth >= 1024) {
    for (let step = 48; step < 282; step += 24) {
      await loadMoreBtn.click();
    }
    await expect(items).toHaveCount(282);
    await expect(loadMoreBtn).toHaveCount(0);
  }

  const whatsappCta = page.locator('main a[href*="wa.me"]').last();
  await expect(whatsappCta).toBeVisible();

  const mainText = await page.locator("main").innerText();
  expect(mainText).not.toMatch(/Mostrando/i);
  expect(mainText).not.toMatch(/Veículos vendidos recentemente/i);
  expect(mainText).not.toMatch(/Entregas registradas/i);
  expect(mainText).not.toMatch(/Galeria de entregas em atualização/i);
  expect(mainText).not.toMatch(/Ver estoque disponível/i);
  expect(mainText).not.toMatch(/\+\d[\d.]*\s+veículos vendidos/i);
  expect(mainText).not.toMatch(/\bsimul\w*\b/i);
  expect(mainText).not.toMatch(/R\$\s*\d/);

  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(hasOverflow).toBe(false);
});
