import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/fotos/**", route => route.fulfill({
    contentType: "image/png", path: "public/branding/placeholder-car.png",
  }));
  await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
});

test("card do estoque: WhatsApp largo com 44 px e coração discreto sem texto", async ({ page }) => {
  await page.goto("/estoque");
  const card = page.locator("article.listing-card").first();
  const whatsapp = card.locator(".listing-card-interest a");
  const cardBox = (await card.boundingBox())!;
  const waBox = (await whatsapp.boundingBox())!;
  expect(waBox.height).toBeGreaterThanOrEqual(44);
  expect(waBox.width).toBeGreaterThanOrEqual(cardBox.width - 2);
  expect(await whatsapp.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(14);
  const save = card.getByRole("button", { name: /^Salvar/ });
  await expect(save).toHaveText("");
  const saveBox = (await save.boundingBox())!;
  expect(saveBox.height).toBeGreaterThanOrEqual(40);
  expect(saveBox.width).toBeGreaterThanOrEqual(40);
  await save.click();
  await expect(card.getByRole("button", { name: /^Remover/ })).toHaveAttribute("aria-pressed", "true");
});

test("celular: textos do card e da barra de baixo com pelo menos 12 px", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 1024, "barra de baixo só no celular");
  await page.goto("/estoque");
  const sizes = await page.evaluate(() => {
    const pick = (selector: string) => Array.from(document.querySelectorAll(selector))
      .filter(el => (el.textContent ?? "").trim())
      .map(el => parseFloat(getComputedStyle(el).fontSize));
    return [
      ...pick("[data-mobile-bottom-nav] span"),
      ...pick(".listing-card-brand"),
      ...pick(".listing-card-badges span"),
    ];
  });
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) expect(size).toBeGreaterThanOrEqual(12);
});

test("selos do card ficam na área de texto, um só, sem cobrir a foto", async ({ page }) => {
  await page.goto("/estoque");
  const photo = page.locator(".listing-card-photo").first();
  await expect(photo.locator(".listing-card-badges")).toHaveCount(0);
  const card = page.locator("article.listing-card").first();
  expect(await card.locator(".listing-card-badges > span:visible").count()).toBeLessThanOrEqual(1);
  const photoBox = (await photo.boundingBox())!;
  const badgeBox = await card.locator(".listing-card-badges > span:visible").first().boundingBox();
  if (badgeBox) expect(badgeBox.y).toBeGreaterThanOrEqual(photoBox.y + photoBox.height - 1);
});

test("selos sem reticências e cards da mesma linha com a mesma largura e foto 4:3", async ({ page }) => {
  await page.goto("/estoque");
  await expect(page.locator("article.listing-card").first()).toBeVisible();
  const clipped = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>(".listing-card-badges > span"))
    .filter(el => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1)
    .map(el => el.textContent));
  expect(clipped).toEqual([]);
  const boxes = await page.evaluate(() => {
    const rows = new Map<number, { w: number; h: number }[]>();
    document.querySelectorAll(".listing-card-item").forEach(item => {
      const card = item.getBoundingClientRect();
      const photo = item.querySelector(".listing-card-photo")?.getBoundingClientRect();
      if (!photo) return;
      const key = Math.round(card.top);
      rows.set(key, [...(rows.get(key) ?? []), { w: card.width, h: photo.height }]);
    });
    return Array.from(rows.values()).filter(row => row.length > 1);
  });
  expect(boxes.length).toBeGreaterThan(0);
  for (const row of boxes) {
    for (const b of row) {
      expect(Math.abs(b.w - row[0].w)).toBeLessThanOrEqual(1);
      expect(Math.abs(b.h - row[0].h)).toBeLessThanOrEqual(1);
    }
  }
});

test("desktop (lg e xl): no mínimo 4 carros por linha no estoque e nos destaques da home", async ({ page }) => {
  if (page.viewportSize()!.width < 1024) {
    await page.goto("/estoque");
    const mobileCols = await page.locator("[data-estoque-list] .listing-card-grid").evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length,
    );
    expect(mobileCols).toBeLessThanOrEqual(2);
    return;
  }
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      { path: "/estoque", grid: "[data-estoque-list] .listing-card-grid" },
      { path: "/", grid: "#destaques .listing-card-grid" },
    ]) {
      await page.goto(route.path);
      const grid = page.locator(route.grid);
      const items = grid.locator(".listing-card-item");
      await expect(items.first()).toBeVisible();
      const total = await items.count();
      const metrics = await grid.evaluate((gridEl) => {
        const tracks = getComputedStyle(gridEl).gridTemplateColumns.trim().split(/\s+/);
        const gridWidth = gridEl.getBoundingClientRect().width;
        const rows = new Map<number, number[]>();
        gridEl.querySelectorAll(".listing-card-item").forEach((el) => {
          const rect = el.getBoundingClientRect();
          const key = Math.round(rect.top);
          rows.set(key, [...(rows.get(key) ?? []), rect.width]);
        });
        return {
          columnCount: tracks.length,
          gridWidth,
          firstRow: Array.from(rows.entries()).sort((a, b) => a[0] - b[0])[0]?.[1] ?? [],
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      expect(metrics.overflow, `${route.path} @ ${width}px sem overflow`).toBe(false);
      expect(metrics.columnCount, `${route.path} @ ${width}px >= 4 colunas`).toBeGreaterThanOrEqual(4);
      expect(metrics.firstRow.length, `${route.path} @ ${width}px`).toBeGreaterThanOrEqual(Math.min(4, total));
      for (const w of metrics.firstRow) {
        expect(Math.abs(w - metrics.firstRow[0])).toBeLessThanOrEqual(1);
        expect(w).toBeLessThanOrEqual(metrics.gridWidth / 4 + 1);
      }
    }
  }
});

test("home no celular: três botões grandes empilhados logo no topo", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 640, "layout só do celular");
  await page.goto("/");
  const hero = page.locator(".hero-cta");
  const buttons = [
    hero.getByRole("link", { name: "Falar no WhatsApp" }),
    hero.getByRole("link", { name: "Ver estoque" }),
    hero.getByRole("button", { name: "Pergunte ao assistente" }),
  ];
  let previousBottom = 0;
  for (const button of buttons) {
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(56);
    expect(box.y).toBeGreaterThanOrEqual(previousBottom);
    previousBottom = box.y + box.height;
  }
  expect(previousBottom).toBeLessThan(page.viewportSize()!.height);
});
