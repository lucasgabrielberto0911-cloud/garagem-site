import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test("galeria pré-carrega vizinhas sem loading=lazy, não dobra download e evita tela preta", async ({ page }) => {
  const db = new PrismaClient();
  const id = "ce2egaleriarapida00000001";
  const photoUrl = (order: number) =>
    `https://pub-e2e-galeria.r2.dev/173117000000${order}-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-g800.webp`;
  const thumbUrl = (order: number) =>
    `https://pub-e2e-galeria.r2.dev/173117000000${order}-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-g800-card.webp`;
  const requestCounts = new Map<string, number>();

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
          create: [0, 1, 2, 3, 4, 5].map((order) => ({
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
      await route.fulfill({
        status: 200,
        contentType: "image/png",
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
    await expect(slides).toHaveCount(6);

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
    await expect(slides.nth(3).locator("img")).toHaveCount(0);
    await expect(slides.nth(4).locator("img")).toHaveCount(0);
    await expect(slides.nth(5).locator("img")).toHaveCount(0);

    // Avança para o slide 1 e depois para o slide 2.
    const nextBtn = page.getByRole("button", { name: "Próxima foto", exact: true });
    await nextBtn.click();
    await expect(slides.nth(1)).toBeInViewport({ ratio: 0.8 });
    await nextBtn.click();
    await expect(slides.nth(2)).toBeInViewport({ ratio: 0.8 });

    // Anterior (1), atual (2) e seguinte (3) sem loading="lazy".
    for (const idx of [1, 2, 3]) {
      const img = slides.nth(idx).locator('img:not([alt=""])');
      await expect(img).toHaveAttribute("loading", "eager");
      await expect(img).not.toHaveAttribute("loading", "lazy");
    }

    // Nenhuma URL foi baixada 2 vezes (blur reutiliza cache sem dobrar download).
    for (const [url, count] of requestCounts.entries()) {
      expect(count, `download duplicado para ${url}`).toBe(1);
    }

    // Fundo do slide nunca é preto puro (rgb(0, 0, 0)).
    const bgColor = await slides.nth(2).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgColor).not.toBe("rgb(0, 0, 0)");
  } finally {
    await db.vehicle.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});
