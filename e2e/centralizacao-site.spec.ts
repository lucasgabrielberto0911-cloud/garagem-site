import { test, expect } from "@playwright/test";
import samples from "./public-samples.json";
import { vehiclePath } from "../src/lib/vehicle-slug";

const PAGES = [
  { name: "home", path: "/" },
  { name: "estoque", path: "/estoque" },
  { name: "ficha", path: `${vehiclePath(samples[0])}?from=%2Festoque` },
  { name: "vender/trocar", path: "/vender" },
  { name: "sobre", path: "/sobre" },
  { name: "dúvidas", path: "/faq" },
  { name: "contato", path: "/contato" },
];

test.describe("Centralização do layout do site inteiro", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
    await page.route("**/fotos/**", route =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#17171A"/></svg>',
      })
    );
  });

  for (const pageInfo of PAGES) {
    test(`${pageInfo.name}: centralizado em 1024, 1280, 1440px e mobile 390px`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));

      // 1. Mobile 390px sem quebra
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(pageInfo.path);
      await expect(page.locator("header")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
      const mobileScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(mobileScrollWidth).toBeLessThanOrEqual(390);

      // 2. Desktop em 1024, 1280 e 1440px
      for (const width of [1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(pageInfo.path);

        const headerBox = await page.locator("header [data-site-container]").first().evaluate(el => {
          const rect = el.getBoundingClientRect();
          const css = getComputedStyle(el);
          const pl = parseFloat(css.paddingLeft);
          const pr = parseFloat(css.paddingRight);
          return {
            x: rect.x,
            width: rect.width,
            leftGap: rect.left,
            rightGap: window.innerWidth - rect.right,
            innerLeft: rect.left + pl,
            innerRight: rect.right - pr,
            pl,
            pr,
          };
        });

        // Header deve ter margens simétricas
        expect(Math.abs(headerBox.leftGap - headerBox.rightGap)).toBeLessThanOrEqual(2);
        expect(Math.abs(headerBox.pl - headerBox.pr)).toBeLessThanOrEqual(1);

        // Container principal do conteúdo da página
        const mainContainer = page.locator("main [data-site-container]").first();
        await expect(mainContainer).toBeVisible();

        const containerBox = await mainContainer.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const css = getComputedStyle(el);
          const pl = parseFloat(css.paddingLeft);
          const pr = parseFloat(css.paddingRight);
          return {
            x: rect.x,
            width: rect.width,
            leftGap: rect.left,
            rightGap: window.innerWidth - rect.right,
            innerLeft: rect.left + pl,
            innerRight: rect.right - pr,
            pl,
            pr,
          };
        });

        // Gap esquerdo == Gap direito (±2px)
        expect(Math.abs(containerBox.leftGap - containerBox.rightGap)).toBeLessThanOrEqual(2);
        // Padding lateral simétrico
        expect(Math.abs(containerBox.pl - containerBox.pr)).toBeLessThanOrEqual(1);
        // Alinhado ao header (mesmo container e mesmo gap esquerdo/direito)
        expect(Math.abs(containerBox.leftGap - headerBox.leftGap)).toBeLessThanOrEqual(2);
        expect(Math.abs(containerBox.rightGap - headerBox.rightGap)).toBeLessThanOrEqual(2);
        expect(Math.abs(containerBox.innerLeft - headerBox.innerLeft)).toBeLessThanOrEqual(2);
        expect(Math.abs(containerBox.innerRight - headerBox.innerRight)).toBeLessThanOrEqual(2);

        // Sem estouro de rolagem horizontal
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth).toBeLessThanOrEqual(width);
      }

      expect(errors).toEqual([]);
    });
  }
});
