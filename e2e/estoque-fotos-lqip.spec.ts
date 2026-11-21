import { test, expect } from "@playwright/test";
import { stubPageFotos } from "./stub-fotos";
import { PHOTO_R2_ORIGIN } from "../src/lib/public-photo-url";
import { STOCK_PRIORITY_COUNT } from "../src/lib/stock-query";

test.beforeEach(async ({ page }) => {
  await stubPageFotos(page);
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("estoque: prévia borrada (LQIP), fallback sem preto chapado, prioridades da 1ª dobra e preconnect R2", async ({
  page,
}) => {
  const width = page.viewportSize()?.width ?? 0;
  test.skip(width !== 390 && width !== 1440, "Validação focada em celular (390) e desktop (1440)");

  await page.goto("/estoque");

  // 1. Preconnect para o host público do R2, sem crossOrigin (imagens são no-cors).
  const preconnectLink = page.locator(`head link[rel="preconnect"][href="${PHOTO_R2_ORIGIN}"]`);
  await expect(preconnectLink).toHaveCount(1);
  expect(await preconnectLink.getAttribute("crossorigin")).toBeNull();

  // 2. Prioridade de rede: preload só na 1ª; 1ª e 2ª em high+eager; demais da 1ª dobra em eager+auto; abaixo lazy+low.
  const covers = page.locator("article.listing-card img");
  const total = await covers.count();
  expect(total).toBeGreaterThanOrEqual(3);

  const firstSrc = (await covers.nth(0).getAttribute("src")) ?? "";
  const secondSrc = (await covers.nth(1).getAttribute("src")) ?? "";
  const preloadTargets = await page
    .locator('head link[rel="preload"][as="image"]')
    .evaluateAll((els) =>
      els.map((el) => `${el.getAttribute("href") ?? ""} ${el.getAttribute("imagesrcset") ?? ""}`.trim()),
    );
  expect(preloadTargets.length).toBeGreaterThanOrEqual(1);
  expect(preloadTargets.length).toBeLessThanOrEqual(2);
  expect(preloadTargets.some((target) => target.includes(firstSrc))).toBe(true);
  expect(preloadTargets.some((target) => target.includes(secondSrc))).toBe(false);

  await expect(covers.nth(0)).toHaveAttribute("fetchpriority", "high");
  await expect(covers.nth(0)).toHaveAttribute("loading", "eager");
  await expect(covers.nth(1)).toHaveAttribute("fetchpriority", "high");
  await expect(covers.nth(1)).toHaveAttribute("loading", "eager");

  const firstFoldLimit = Math.min(total, STOCK_PRIORITY_COUNT);
  for (let i = 2; i < firstFoldLimit; i++) {
    await expect(covers.nth(i)).toHaveAttribute("loading", "eager");
    await expect(covers.nth(i)).not.toHaveAttribute("fetchpriority", "low");
  }
  for (let i = STOCK_PRIORITY_COUNT; i < total; i++) {
    await expect(covers.nth(i)).toHaveAttribute("loading", "lazy");
    await expect(covers.nth(i)).toHaveAttribute("fetchpriority", "low");
  }

  // 3. Caixa da foto não usa fundo preto chapado (#0D0D0F ou #000) — tem gradiente neutro.
  const photoBoxStyle = await page
    .locator(".listing-card-photo")
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
      };
    });
  expect(photoBoxStyle.backgroundImage).toMatch(/linear-gradient/i);
  expect(photoBoxStyle.backgroundColor).not.toBe("rgb(13, 13, 15)");
  expect(photoBoxStyle.backgroundColor).not.toBe("rgb(0, 0, 0)");

  // 4. Camada LQIP inline borrada presente (gerada no servidor a partir da fixture local no E2E).
  const lqipLayer = page.locator(".listing-card-photo [data-photo-lqip]").first();
  await expect(lqipLayer).toHaveCount(1);
  const lqipBg = await lqipLayer.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(lqipBg).toMatch(/data:image\/webp;base64,/);

  // 5. Fotos carregadas ficam totalmente visíveis (opacity 1).
  for (let i = 0; i < Math.min(total, 3); i++) {
    await expect
      .poll(() =>
        covers.nth(i).evaluate((img) => {
          const el = img as HTMLImageElement;
          return el.complete && el.naturalWidth > 0 && getComputedStyle(el).opacity === "1";
        }),
      )
      .toBe(true);
  }
});

test("estoque: foto nunca fica presa em opacity 0 mesmo se o evento load não disparar", async ({
  page,
}) => {
  const width = page.viewportSize()?.width ?? 0;
  test.skip(width !== 390 && width !== 1440, "Validação focada em celular (390) e desktop (1440)");

  let releaseStalled!: () => void;
  const stalledGate = new Promise<void>((resolve) => {
    releaseStalled = resolve;
  });
  // Segura a 2ª capa (Duster da amostra E2E) sem responder para simular load que não dispara.
  const stalledPattern = "**/fotos/**1790785425727-*";
  await page.route(stalledPattern, async (route) => {
    await stalledGate;
    await route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }).catch(() => {});
  });

  try {
    await page.goto("/estoque", { waitUntil: "domcontentloaded" });
    const stalledImg = page.locator('article.listing-card img[src*="1790785425727-"]');
    await expect(stalledImg).toHaveCount(1);
    await expect(stalledImg).toHaveAttribute("data-photo-state", "loading");
    await expect
      .poll(
        () =>
          stalledImg.evaluate((el) => ({
            state: (el as HTMLElement).dataset.photoState ?? "",
            opacity: getComputedStyle(el).opacity,
          })),
        { timeout: 8000 },
      )
      .toEqual({ state: "ready", opacity: "1" });
  } finally {
    releaseStalled();
    await page.unroute(stalledPattern);
  }
});

test("estoque: fotos ficam visíveis com JavaScript desligado", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "SSR sem JS não varia por viewport");
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await stubPageFotos(page);
    await page.goto("/estoque");
    const covers = page.locator("article.listing-card img");
    const total = await covers.count();
    expect(total).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < Math.min(total, 3); i++) {
      await expect
        .poll(() =>
          covers.nth(i).evaluate((img) => {
            const el = img as HTMLImageElement;
            return (
              el.dataset.photoState === undefined &&
              el.complete &&
              el.naturalWidth > 0 &&
              getComputedStyle(el).opacity === "1"
            );
          }),
        )
        .toBe(true);
    }
  } finally {
    await context.close();
  }
});
