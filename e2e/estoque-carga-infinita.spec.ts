import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Fotos são fixture offline (sem egress); estoque e API são os reais do banco local.
test("mobile 390px: rolar até o fim carrega a página 2 do estoque", async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 390, "cenário fixo em 390px");
  const image = readFileSync("public/branding/placeholder-car.png");
  await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", body: image }));

  const pages: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname === "/api/estoque") pages.push(url.searchParams.get("page") ?? "");
  });

  // O seed tem 3 carros e a página padrão traz 8: a página 1 vem com 1 carro (total real 3)
  // e a página 2 vai para a API real.
  await page.route(/\/api\/estoque\?(?=.*page=1&)/, async route => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, vehicles: data.vehicles.slice(0, 1), pageSize: 1, hasMore: true } });
  });

  await page.goto("/estoque?sort=menor-preco");
  const cards = page.locator("[data-stock-card], article");
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => cards.count()).toBeGreaterThan(before);
  expect(pages).toContain("2");

  // Segue carregando até o fim; o texto antigo sem ação nunca mais aparece.
  for (let i = 0; i < 4; i += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
  }
  await expect(page.getByText("Role para ver o restante do estoque")).toHaveCount(0);
  await expect(page.getByText(/Você viu os \d+ veículos/)).toBeVisible();
});
