import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

test("mobile: botão, retorno da ficha e rolagem carregam o estoque", async ({ page }) => {
  test.skip(page.viewportSize()?.width !== 390, "cenário fixo em 390px");
  const db = new PrismaClient();
  const prefix = "ce2ecargainfinita";
  try {
    await db.vehicle.createMany({ data: Array.from({ length: 17 }, (_, i) => ({
      id: `${prefix}${i}`, brand: "TesteCargaInfinita", model: `Modelo ${i}`,
      year: 2020, yearModel: 2020, price: 50000 + i, km: 10000,
      transmission: "Manual", fuel: "Flex", status: "disponivel", historical: false,
    })) });
    const image = readFileSync("public/branding/placeholder-car.png");
    await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", body: image }));
    const pages: string[] = [];
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname === "/api/estoque") pages.push(url.searchParams.get("page") ?? "");
    });
    await page.goto("/estoque?brand=TesteCargaInfinita&sort=menor-preco");
    const cards = page.locator("a[data-stock-card]");
    await expect(page.locator("[data-estoque-list]")).toHaveAttribute("aria-busy", "false");
    await expect(cards).toHaveCount(8);
    await page.getByRole("button", { name: "Ver mais veículos" }).dispatchEvent("click");
    await expect(cards).toHaveCount(16);
    expect(pages).toContain("2");
    await cards.nth(10).click();
    await expect(page).toHaveURL(/\/estoque\//);
    await page.goBack();
    await expect(cards).toHaveCount(16);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(cards).toHaveCount(17);
    expect(pages).toContain("3");
    await expect(page.getByText("Você viu os 17 veículos")).toBeVisible();
  } finally {
    await db.vehicle.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.$disconnect();
  }
});
