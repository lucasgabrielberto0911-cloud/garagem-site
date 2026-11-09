import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PHOTO_BLOB_ORIGIN } from "../src/lib/public-photo-url";

test("capa, JSON-LD e navegação respeitam a ordem salva, independente da inserção e do nome no Blob", async ({ page, request }) => {
  const db = new PrismaClient();
  const id = "ce2eordemkicks000000000001";
  // O prefixo do arquivo registra uma ordem antiga; só Photo.order governa a publicação.
  const url = (order: number) => `${PHOTO_BLOB_ORIGIN}/estoque/${id}/o${6 - order}-foto.webp`;
  try {
    await db.vehicle.create({ data: {
      id, brand: "Nissan", model: "Kicks Teste Ordem", category: "carro",
      year: 2019, yearModel: 2019, price: 80000, km: 78000, fuel: "Flex", transmission: "Automático",
      photos: { create: [4, 0, 6, 1, 3, 5, 2].map(order => ({ order, url: url(order), thumbnailUrl: url(order) })) },
    } });
    await page.route("https://*.public.blob.vercel-storage.com/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
    await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", path: "public/branding/placeholder-car.png" }));
    await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
    const data = await (await request.get("/api/estoque?q=Kicks%20Teste%20Ordem")).json();
    const stock = data.vehicles.find((vehicle: { id: string }) => vehicle.id === id);
    expect(stock.photos[0].url).toBe(url(0));
    await page.goto(`/estoque/${id}`);
    const images = await page.locator('script[type="application/ld+json"]').allTextContents();
    const vehicle = images.map(text => JSON.parse(text)).find(node => node.sku === id);
    expect(vehicle.image).toEqual(Array.from({ length: 7 }, (_, order) => url(order)));
    const slides = page.locator(".gallery-strip > li");
    await expect(slides).toHaveCount(7);
    for (let order = 0; order < 7; order++) {
      await expect(slides.nth(order)).toBeInViewport({ ratio: 0.8 });
      await expect(slides.nth(order).locator("img")).toHaveAttribute("src", url(order));
      if (order < 6) await page.getByRole("button", { name: "Próxima foto", exact: true }).click();
    }
    await expect(page.getByRole("button", { name: "Próxima foto", exact: true })).toBeDisabled();
  } finally {
    await db.vehicle.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});
