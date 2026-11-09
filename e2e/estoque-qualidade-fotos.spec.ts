import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

test("estoque recomenda galerias completas, mantém paginação e mostra moto só por pedido", async ({ page, request }) => {
  const db = new PrismaClient();
  const prefix = "ce2equalidadefotos";
  const brand = "TesteQualidadeFotos";
  const ids = ["incompleto", "completoantigo", "completonovo", "moto", "reservado", "vendido"];
  try {
    for (const [index, suffix] of ids.entries()) {
      const id = `${prefix}${suffix}`;
      await db.vehicle.create({ data: {
        id, brand, model: suffix, category: suffix === "moto" ? "moto" : "carro",
        year: 2020, yearModel: 2020, price: 50000 + index * 1000, km: 10000,
        transmission: "Manual", fuel: "Flex", historical: false,
        status: ["reservado", "vendido"].includes(suffix) ? suffix : "disponivel",
        createdAt: new Date(`2026-11-0${suffix === "completoantigo" ? 1 : suffix === "completonovo" ? 2 : 3}T12:00:00Z`),
        photos: { create: Array.from({ length: suffix === "incompleto" ? 1 : 5 }, (_, order) => ({
          url: `https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/${id}/${order}.webp`, order,
        })) },
      } });
    }
    const image = readFileSync("public/branding/placeholder-car.png");
    await page.route("**/fotos/**", route => route.fulfill({ contentType: "image/png", body: image }));
    await page.goto(`/estoque?brand=${brand}`);
    const cards = page.locator("[data-estoque-list] article.listing-card");
    await expect(cards).toHaveCount(3);
    for (const [index, suffix] of ["completonovo", "completoantigo", "incompleto"].entries()) {
      await expect(cards.nth(index).locator("a[data-stock-card]")).toHaveAttribute("href", new RegExp(`${prefix}${suffix}$`));
    }
    const first = await (await request.get(`/api/estoque?brand=${brand}&pageSize=2`)).json();
    const second = await (await request.get(`/api/estoque?brand=${brand}&pageSize=2&page=2`)).json();
    expect(first.total).toBe(3);
    expect([...first.vehicles, ...second.vehicles].map((v: { id: string }) => v.id)).toEqual(["completonovo", "completoantigo", "incompleto"].map(id => prefix + id));
    const price = await (await request.get(`/api/estoque?brand=${brand}&sort=menor-preco`)).json();
    expect(price.vehicles[0].id).toBe(`${prefix}incompleto`);
    for (const query of ["category=moto", "q=moto", "q=motocicleta"]) {
      const response = await request.get(`/api/estoque?brand=${brand}&${query}`);
      expect(response.status()).toBe(200);
      expect((await response.json()).vehicles.map((v: { id: string }) => v.id)).toEqual([`${prefix}moto`]);
    }
    await page.goto(`/estoque?brand=${brand}&category=moto`);
    await expect(cards).toHaveCount(1);
    await expect(cards.first().locator("a[data-stock-card]")).toHaveAttribute("href", new RegExp(`${prefix}moto$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    await db.vehicle.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.$disconnect();
  }
});
