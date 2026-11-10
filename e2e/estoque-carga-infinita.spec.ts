import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { STOCK_POSITION_KEY } from "../src/lib/stock-return";

test("mobile: botão, retorno da ficha e rolagem carregam o estoque", async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 390, "cenário fixo em 390px");
  const db = new PrismaClient();
  const prefix = "ce2ecargainfinita";
  try {
    await db.vehicle.createMany({ data: Array.from({ length: 33 }, (_, i) => ({
      id: `${prefix}${i}`, brand: "TesteCargaInfinita", model: `Modelo ${i}`,
      year: 2020, yearModel: 2020, price: 50000 + i, km: 10000,
      transmission: "Manual", fuel: "Flex", status: "disponivel", historical: false,
    })) });
    const image = readFileSync("public/branding/placeholder-car.png");
    await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", body: image }));
    // Isolamento: o prefetch do rodapé (/guia, /seminovos) rodaria getCityShowcaseVehicles com os 33
    // veículos de teste no banco e gravaria o resultado no cache (3600 s), contaminando outros specs.
    await page.route(url => /^\/(guia|seminovos)(\/|$)/.test(url.pathname), route => route.abort());
    const pages: string[] = [];
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname === "/api/estoque") pages.push(url.searchParams.get("page") ?? "");
    });
    await page.goto("/estoque?brand=TesteCargaInfinita&sort=menor-preco&maxPrice=50013");
    const cards = page.locator("[data-estoque-list] article.listing-card");
    const links = cards.locator("a[data-stock-card]");
    await expect(page.locator("[data-estoque-list]")).toHaveAttribute("aria-busy", "false");
    await expect(cards).toHaveCount(14);
    await expect(page.getByRole("button", { name: "Ver mais veículos" })).toHaveCount(0);
    await expect(page.getByText("Você viu os 14 veículos")).toBeVisible();
    await page.goto("/estoque?brand=TesteCargaInfinita&sort=menor-preco");
    await expect(cards).toHaveCount(16);
    await expect(links).toHaveCount(16);
    await page.getByRole("button", { name: "Ver mais veículos" }).dispatchEvent("click");
    await expect(cards).toHaveCount(32);
    await expect(links).toHaveCount(32);
    for (let i = 16; i < 32; i++) {
      await expect(cards.nth(i).locator("a[data-stock-card]")).toHaveAttribute("href", new RegExp(`${prefix}${i}$`));
    }
    expect(pages).toContain("2");
    await cards.nth(26).locator("a[data-stock-card]").click();
    await expect(page).toHaveURL(/\/estoque\//);
    await page.goBack();
    await expect(cards).toHaveCount(32);
    await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), STOCK_POSITION_KEY)).toBeNull();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Ver mais veículos" }).evaluate(button => button.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect(cards).toHaveCount(33);
    expect(pages).toContain("3");
    await expect(page.getByText("Você viu os 33 veículos")).toBeVisible();
  } finally {
    await db.vehicle.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.$disconnect();
  }
});
