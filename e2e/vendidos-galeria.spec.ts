import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { stubPageFotos } from "./stub-fotos";

const totalDeliveries = (
  JSON.parse(
    readFileSync(
      join(process.cwd(), "src/data/vendidos-insta.json"),
      "utf8",
    ),
  ) as unknown[]
).length;

test("galeria /vendidos exibe título, fotos 4:5 com LQIP e srcset, selo VENDIDO aria-hidden, 24 iniciais, +24 em Ver mais, 4 colunas no desktop e 2 no mobile", async ({
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

  const firstImg = items.nth(0).locator("img");
  await expect(firstImg).toHaveAttribute("loading", "eager");
  await expect(firstImg).toHaveAttribute("fetchpriority", "high");
  await expect(firstImg).toHaveAttribute("decoding", "async");
  await expect(items.nth(3).locator("img")).toHaveAttribute("loading", "eager");
  await expect(items.nth(4).locator("img")).toHaveAttribute("loading", "lazy");
  await expect(items.nth(9).locator("img")).toHaveAttribute("loading", "lazy");
  await expect(firstImg).toHaveAttribute(
    "alt",
    /entregue a cliente da Sua Garagem$/,
  );

  // srcset responsivo com 360w e 600w + camada LQIP borrada + fundo sem preto chapado.
  const firstSrcSet = (await firstImg.getAttribute("srcset")) ?? "";
  expect(firstSrcSet).toContain("360w");
  expect(firstSrcSet).toContain("600w");

  const firstLqip = items.nth(0).locator("[data-delivery-lqip]");
  await expect(firstLqip).toHaveCount(1);
  const lqipStyle = await firstLqip.evaluate((el) => {
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

  // Fotos carregadas ficam totalmente visíveis (opacity 1).
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
              getComputedStyle(el).opacity === "1"
            );
          }),
      )
      .toBe(true);
  }

  const badges = items.locator("[data-sold-badge]");
  await expect(badges).toHaveCount(24);
  for (let i = 0; i < 4; i++) {
    await expect(badges.nth(i)).toBeVisible();
    await expect(badges.nth(i)).toHaveText("VENDIDO");
    await expect(badges.nth(i)).toHaveAttribute("aria-hidden", "true");
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
  await expect(items.nth(24).locator("img")).toHaveAttribute("loading", "lazy");

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

test("galeria /vendidos: foto nunca fica presa em opacity 0 mesmo se o evento load não disparar", async ({
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

  const secondItem = (
    JSON.parse(
      readFileSync(
        join(process.cwd(), "src/data/vendidos-insta.json"),
        "utf8",
      ),
    ) as Array<{ id: string }>
  )[1];

  let releaseStalled!: () => void;
  const stalledGate = new Promise<void>((resolve) => {
    releaseStalled = resolve;
  });
  const stalledPattern = `**/vendidos-insta/*${secondItem.id}*.webp`;
  await page.route(stalledPattern, async (route) => {
    await stalledGate;
    await route
      .fulfill({
        contentType: "image/png",
        path: "public/branding/placeholder-car.png",
      })
      .catch(() => {});
  });

  try {
    await page.goto("/vendidos", { waitUntil: "domcontentloaded" });
    const stalledImg = page
      .locator("[data-insta-deliveries-grid] > li")
      .nth(1)
      .locator("img");
    await expect
      .poll(
        () =>
          stalledImg.evaluate((el) => ({
            state: (el as HTMLElement).dataset.photoState ?? "",
            opacity: getComputedStyle(el).opacity,
          })),
        { timeout: 5000 },
      )
      .toEqual({ state: "ready", opacity: "1" });
  } finally {
    releaseStalled();
    await page.unroute(stalledPattern);
  }
});
