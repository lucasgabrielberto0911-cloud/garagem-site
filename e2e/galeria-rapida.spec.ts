import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test("galeria pré-carrega vizinhas sem loading=lazy, não dobra download e mantém imagem visível durante espera", async ({ page }) => {
  const db = new PrismaClient();
  const id = `ce2egaleria${Date.now().toString(36).padStart(10, "0")}${Math.random().toString(36).slice(2, 6)}`;
  const photoUrl = (order: number) =>
    `https://pub-e2e-galeria.r2.dev/173117000000${order}-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-g800.webp`;
  const previewUrl = (order: number) =>
    `https://pub-e2e-galeria.r2.dev/173117000000${order}-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-g800-preview.webp`;
  const hasFulfilledSlide = (order: number) =>
    fulfilledLargeUrls.has(photoUrl(order)) || fulfilledLargeUrls.has(previewUrl(order));
  const thumbUrl = (order: number) =>
    `https://pub-e2e-galeria.r2.dev/173117000000${order}-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-g800-card.webp`;
  const requestCounts = new Map<string, number>();
  const fulfilledLargeUrls = new Set<string>();

  try {
    await db.vehicle.deleteMany({ where: { id } });
    await db.vehicle.create({
      data: {
        id,
        brand: "Fiat",
        model: "Modelo Teste Galeria",
        category: "carro",
        year: 2022,
        yearModel: 2022,
        price: 79900,
        km: 42000,
        fuel: "Flex",
        transmission: "Manual",
        photos: {
          create: [0, 1, 2, 3, 4, 5, 6].map((order) => ({
            order,
            url: photoUrl(order),
            thumbnailUrl: thumbUrl(order),
          })),
        },
      },
    });

    await page.route("https://pub-e2e-galeria.r2.dev/**", async (route) => {
      const url = route.request().url();
      requestCounts.set(url, (requestCounts.get(url) ?? 0) + 1);
      const isLarge = /-g800(?:-preview)?\.webp(?:$|\?)/.test(url);
      if (isLarge) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        fulfilledLargeUrls.add(url);
      }
      await route.fulfill({
        status: 200,
        contentType: "image/png",
        headers: { "Cache-Control": "public, max-age=31536000, immutable" },
        path: "public/branding/placeholder-car.png",
      });
    });
    await page.route("**/fotos/**", (route) =>
      route.fulfill({
        contentType: "image/png",
        path: "public/branding/placeholder-car.png",
      }),
    );
    await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));

    await page.goto(`/estoque/${id}`, { waitUntil: "networkidle" });

    const slides = page.locator(".gallery-strip > li");
    await expect(slides).toHaveCount(7);

    // 1ª, 2ª e 3ª fotos já montadas com loading="eager" (sem loading="lazy").
    for (const idx of [0, 1, 2]) {
      const imgs = slides.nth(idx).locator("img");
      await expect(imgs.first()).toHaveAttribute("loading", "eager");
      const count = await imgs.count();
      for (let j = 0; j < count; j++) {
        await expect(imgs.nth(j)).not.toHaveAttribute("loading", "lazy");
      }
    }

    // Não baixa todas as fotos de uma vez na abertura.
    for (const idx of [3, 4, 5, 6]) {
      await expect(slides.nth(idx).locator("img")).toHaveCount(0);
    }

    // Avança rápido até um slide distante (slide 4) enquanto o -g800.webp ainda está pendente.
    const nextBtn = page.getByRole("button", { name: "Próxima foto", exact: true });
    for (let step = 0; step < 4; step++) {
      await nextBtn.click();
    }
    await expect(slides.nth(4)).toBeInViewport({ ratio: 0.8 });

    // Anterior (3), atual (4) e seguinte (5) montados sem loading="lazy".
    for (const idx of [3, 4, 5]) {
      const img = slides.nth(idx).locator('img:not([alt=""])');
      await expect(img).toHaveAttribute("loading", "eager");
      await expect(img).not.toHaveAttribute("loading", "lazy");
    }

    // Enquanto a foto principal do slide 4 ainda não terminou, há uma <img> visível (prévia) no visor.
    expect(hasFulfilledSlide(4)).toBe(false);
    await expect
      .poll(
        () =>
          slides.nth(4).evaluate((li) =>
            Array.from(li.querySelectorAll("img")).some((img) => {
              const style = getComputedStyle(img);
              const parentStyle = img.parentElement ? getComputedStyle(img.parentElement) : null;
              const opacity = Number(style.opacity) * (parentStyle ? Number(parentStyle.opacity) : 1);
              return opacity > 0 && img.complete && img.naturalWidth > 0;
            }),
          ),
        { timeout: 1200 },
      )
      .toBe(true);
    expect(hasFulfilledSlide(4)).toBe(false);

    // Após a foto principal decodificar, ela aparece com opacity 1.
    await expect.poll(() => hasFulfilledSlide(4)).toBe(true);
    await expect
      .poll(() =>
        slides.nth(4).locator('img:not([alt=""])').evaluate((img) => {
          const el = img as HTMLImageElement;
          const parentOpacity = el.parentElement ? Number(getComputedStyle(el.parentElement).opacity) : 1;
          return Number(getComputedStyle(el).opacity) * parentOpacity === 1 && el.naturalWidth > 0;
        }),
      )
      .toBe(true);

    // Nenhuma foto grande (-g800.webp) foi baixada 2 vezes (blur reutiliza cache sem dobrar download).
    // No celular (sem faixa de miniaturas), nem mesmo as miniaturas (-g800-card.webp) repetem pedido.
    const isMobileViewport = (page.viewportSize()?.width ?? 0) < 1024;
    for (const [url, count] of requestCounts.entries()) {
      const isLarge = /-g800(?:-preview)?\.webp(?:$|\?)/.test(url);
      if (isLarge || isMobileViewport) {
        expect(count, `download duplicado para ${url}`).toBe(1);
      } else {
        // Com page.route ativo, o Chromium desativa o cache de disco (Network.setCacheDisabled);
        // no desktop a faixa de miniaturas baixa cedo e o slide tardio revalida sem cache de disco.
        expect(count, `download excessivo para ${url}`).toBeLessThanOrEqual(2);
      }
    }

    // Lightbox: ao trocar para foto ainda não baixada (foto 7), mantém foto anterior visível durante a espera.
    await page.getByRole("button", { name: /Ver as \d+ fotos/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const lightboxViewport = dialog.locator('[data-lightbox-viewport="true"]');
    await expect
      .poll(() =>
        lightboxViewport.locator('[data-lightbox-current="true"] img').evaluate((img) => {
          const el = img as HTMLImageElement;
          const parentOpacity = el.parentElement ? Number(getComputedStyle(el.parentElement).opacity) : 1;
          return Number(getComputedStyle(el).opacity) * parentOpacity === 1 && el.naturalWidth > 0;
        }),
      )
      .toBe(true);
    await dialog.getByRole("button", { name: "Ver foto 7", exact: true }).click();
    expect(fulfilledLargeUrls.has(photoUrl(6))).toBe(false);
    const hasVisibleLightboxImg = await lightboxViewport.evaluate((root) =>
      Array.from(root.querySelectorAll("img")).some((img) => {
        const style = getComputedStyle(img);
        const parentStyle = img.parentElement ? getComputedStyle(img.parentElement) : null;
        const opacity = Number(style.opacity) * (parentStyle ? Number(parentStyle.opacity) : 1);
        return opacity > 0 && img.complete && img.naturalWidth > 0;
      }),
    );
    expect(hasVisibleLightboxImg).toBe(true);
    expect(fulfilledLargeUrls.has(photoUrl(6))).toBe(false);
  } finally {
    await db.vehicle.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});
