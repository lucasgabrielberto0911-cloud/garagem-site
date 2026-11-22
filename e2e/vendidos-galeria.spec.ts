import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { stubPageFotos } from "./stub-fotos";

type DeliveryEntry = {
  id: string;
  art: boolean;
};

const deliveries = JSON.parse(
  readFileSync(
    join(process.cwd(), "src/data/vendidos-insta.json"),
    "utf8",
  ),
) as DeliveryEntry[];

const totalDeliveries = deliveries.length;

test("galeria /vendidos exibe título, subtítulo, fotos 4:5 com srcset/LQIP só nas lazy, selo VENDIDO só sem arte, 24 iniciais, +24 com aria-live, 4 colunas no desktop e 2 no mobile", async ({
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
    page.getByText("Clientes que já fecharam negócio com a Garagem."),
  ).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Fotos de clientes com os veículos vendidos pela Garagem.",
  );

  const grid = page.locator("[data-insta-deliveries-grid]");
  await expect(grid).toBeVisible();

  const items = grid.locator("> li");
  await expect(items).toHaveCount(24);

  await expect(grid.locator("a")).toHaveCount(0);
  await expect(page.locator('main a[href*="instagram.com"]')).toHaveCount(0);

  const firstImg = items.nth(0).locator("img");
  await expect(firstImg).toHaveAttribute("loading", "eager");
  await expect(firstImg).toHaveAttribute("fetchpriority", "high");
  await expect(firstImg).toHaveAttribute("decoding", "async");
  await expect(items.nth(3).locator("img")).toHaveAttribute("loading", "eager");
  await expect(items.nth(4).locator("img")).toHaveAttribute("loading", "lazy");
  await expect(items.nth(9).locator("img")).toHaveAttribute("loading", "lazy");

  const firstAlt = (await firstImg.getAttribute("alt")) ?? "";
  expect(firstAlt).toMatch(/entregue a cliente da Garagem$/);
  expect(firstAlt).not.toMatch(/Sua Garagem/i);

  const firstSizes = (await firstImg.getAttribute("sizes")) ?? "";
  expect(firstSizes).toContain("22vw");
  expect(firstSizes).not.toContain("23vw");

  // srcset responsivo com 360w e 600w; LQIP apenas nas lazy (não nas 4 eager).
  const firstSrcSet = (await firstImg.getAttribute("srcset")) ?? "";
  expect(firstSrcSet).toContain("360w");
  expect(firstSrcSet).toContain("600w");

  for (let i = 0; i < 4; i++) {
    await expect(items.nth(i).locator("[data-delivery-lqip]")).toHaveCount(0);
  }

  const firstLazyLqip = items.nth(4).locator("[data-delivery-lqip]");
  await expect(firstLazyLqip).toHaveCount(1);
  const lqipStyle = await firstLazyLqip.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      backgroundImage: style.backgroundImage,
      filter: style.filter,
    };
  });
  expect(lqipStyle.backgroundImage).toMatch(/data:image\/webp;base64,/);
  expect(lqipStyle.filter).toContain("blur");

  const photoBoxStyle = await items
    .nth(0)
    .locator("[data-delivery-photo-box]")
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
      };
    });
  expect(photoBoxStyle.backgroundImage).toMatch(/linear-gradient/i);
  expect(photoBoxStyle.backgroundColor).not.toBe("rgb(0, 0, 0)");
  expect(photoBoxStyle.backgroundColor).not.toBe("rgb(13, 13, 15)");

  // Fotos eager nunca recebem data-photo-state="loading" e ficam totalmente visíveis.
  for (let i = 0; i < 4; i++) {
    await expect
      .poll(() =>
        items
          .nth(i)
          .locator("img")
          .evaluate((img) => {
            const el = img as HTMLImageElement;
            return (
              el.complete &&
              el.naturalWidth > 0 &&
              el.dataset.photoState !== "loading" &&
              getComputedStyle(el).opacity === "1"
            );
          }),
      )
      .toBe(true);
  }

  // Selo VENDIDO ausente quando item.art === true e presente nos demais.
  const expectedInitialBadges = deliveries
    .slice(0, 24)
    .filter((item) => !item.art).length;
  await expect(items.locator("[data-sold-badge]")).toHaveCount(
    expectedInitialBadges,
  );
  const firstArtIndex = deliveries.findIndex((item) => item.art);
  if (firstArtIndex >= 0 && firstArtIndex < 24) {
    await expect(
      items.nth(firstArtIndex).locator("[data-sold-badge]"),
    ).toHaveCount(0);
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

  const liveStatus = page.locator("[data-deliveries-status]");
  await expect(liveStatus).toHaveAttribute("aria-live", "polite");

  await loadMoreBtn.click();
  await expect(items).toHaveCount(48);
  await expect(liveStatus).toHaveText("Mais 24 entregas carregadas");
  await expect(items.nth(24).locator("img")).toHaveAttribute("loading", "lazy");

  // Após carregar o 2º lote, confere selo VENDIDO nos itens com art === false.
  const expectedAfterMoreBadges = deliveries
    .slice(0, 48)
    .filter((item) => !item.art).length;
  expect(expectedAfterMoreBadges).toBeGreaterThan(0);
  await expect(items.locator("[data-sold-badge]")).toHaveCount(
    expectedAfterMoreBadges,
  );
  const firstPlainIndex = deliveries.findIndex((item) => !item.art);
  expect(firstPlainIndex).toBeGreaterThanOrEqual(0);
  expect(firstPlainIndex).toBeLessThan(48);
  const plainBadge = items.nth(firstPlainIndex).locator("[data-sold-badge]");
  await expect(plainBadge).toHaveCount(1);
  await expect(plainBadge).toHaveText("VENDIDO");
  await expect(plainBadge).toHaveAttribute("aria-hidden", "true");

  if (viewportWidth >= 1024) {
    for (let step = 48; step < totalDeliveries; step += 24) {
      await loadMoreBtn.click();
    }
    await expect(items).toHaveCount(totalDeliveries);
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

test("galeria /vendidos: 1ª foto eager nunca entra em loading após hidratação e foto lazy travada é revelada pelo fallback", async ({
  page,
}) => {
  const width = page.viewportSize()?.width ?? 0;
  test.skip(
    width !== 390 && width !== 1440,
    "Validação focada em celular (390) e desktop (1440)",
  );

  await page.addInitScript(() =>
    localStorage.setItem("garagem_consent", "essential"),
  );
  await stubPageFotos(page);

  const firstItem = deliveries[0];
  const fifthItem = deliveries[4];

  let releaseStalled!: () => void;
  const stalledGate = new Promise<void>((resolve) => {
    releaseStalled = resolve;
  });
  const firstPattern = `**/vendidos-insta/*${firstItem.id}*.webp`;
  const fifthPattern = `**/vendidos-insta/*${fifthItem.id}*.webp`;

  const stallHandler = async (route: import("@playwright/test").Route) => {
    await stalledGate;
    await route
      .fulfill({
        contentType: "image/png",
        path: "public/branding/placeholder-car.png",
      })
      .catch(() => {});
  };
  await page.route(firstPattern, stallHandler);
  await page.route(fifthPattern, stallHandler);

  try {
    await page.goto("/vendidos", { waitUntil: "domcontentloaded" });
    const firstImg = page
      .locator("[data-insta-deliveries-grid] > li")
      .nth(0)
      .locator("img");
    const lazyImg = page
      .locator("[data-insta-deliveries-grid] > li")
      .nth(4)
      .locator("img");

    // Aguarda a hidratação rodar o useLayoutEffect na foto lazy (índice 4).
    await expect
      .poll(() => lazyImg.getAttribute("data-photo-state"), { timeout: 5000 })
      .toMatch(/^(loading|ready)$/);

    const firstState = await firstImg.evaluate((el) => ({
      complete: (el as HTMLImageElement).complete,
      state: (el as HTMLElement).dataset.photoState ?? "",
      opacity: getComputedStyle(el).opacity,
    }));
    expect(firstState.complete).toBe(false);
    expect(firstState.state).not.toBe("loading");
    expect(firstState.opacity).toBe("1");

    await lazyImg.scrollIntoViewIfNeeded();
    await expect
      .poll(
        () =>
          lazyImg.evaluate((el) => ({
            state: (el as HTMLElement).dataset.photoState ?? "",
            opacity: getComputedStyle(el).opacity,
          })),
        { timeout: 5000 },
      )
      .toEqual({ state: "ready", opacity: "1" });
  } finally {
    releaseStalled();
    await page.unroute(firstPattern);
    await page.unroute(fifthPattern);
  }
});
