import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
const local = process.env.E2E_TEST === "1" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) &&
  ["/ci", "/garagem_e2e"].includes(database.pathname);
test.skip(!local, "Requer banco local dedicado.");

test("cidade combina com busca, câmbio, preço, paginação e recarga sem expor a cidade nos cards", async ({ page }, info) => {
  const db = new PrismaClient();
  const model = `FiltroCidade${randomUUID().replaceAll("-", "")}`;
  const rows = Array.from({ length: 15 }, (_, index) => ({
    id: `ccidade${randomUUID().replaceAll("-", "")}`,
    brand: "Teste", model, year: 2020, yearModel: 2020, km: 1000, fuel: "Flex",
    transmission: index >= 9 && index < 12 ? "Manual" : "Automático",
    locationCity: index >= 12 && index < 14 ? "linhares" : "serra",
    price: index === 14 ? 95000 : 60000,
  }));
  const expected = rows.slice(0, 9).map(row => row.id);
  try {
    await db.vehicle.createMany({ data: rows });
    await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
    const query = new URLSearchParams({ q: model, transmission: "automatico", minPrice: "50000", maxPrice: "80000", city: "linhares", page: "4" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/estoque?${query}`);
    const cards = page.locator("article.listing-card");
    await expect(cards).toHaveCount(2);

    if (info.project.name.startsWith("mobile")) {
      await page.getByRole("group", { name: "Filtrar por cidade" }).getByRole("button", { name: "Serra", exact: true }).click();
    } else {
      await page.getByLabel("Cidade", { exact: true }).selectOption("serra");
    }
    await expect.poll(() => new URL(page.url()).searchParams.get("city")).toBe("serra");
    const selected = new URL(page.url()).searchParams;
    expect(selected.get("page")).toBeNull();
    for (const key of ["q", "transmission", "minPrice", "maxPrice"]) expect(selected.get(key)).toBe(query.get(key));

    const first = await (await page.request.get(`/api/estoque?${selected}&page=1&pageSize=2`)).json();
    const second = await (await page.request.get(`/api/estoque?${selected}&page=2&pageSize=2`)).json();
    expect(first.total).toBe(9);
    expect(first.hasMore).toBe(true);
    expect(second.page).toBe(2);
    const ids = [...first.vehicles, ...second.vehicles].map((vehicle: { id: string }) => vehicle.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id: string) => expected.includes(id))).toBe(true);
    expect(JSON.stringify([first, second])).not.toContain("locationCity");

    await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(8);
    await cards.last().scrollIntoViewIfNeeded();
    await expect(cards).toHaveCount(9);
    await expect(cards.first()).not.toContainText(/Linhares|Serra|Vitória|Aracruz/);
    await page.reload();
    if (info.project.name.startsWith("mobile")) {
      const group = page.getByRole("group", { name: "Filtrar por cidade" });
      const chip = group.getByRole("button", { name: "Serra", exact: true });
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await group.scrollIntoViewIfNeeded();
      await expect(chip).toBeInViewport();
    } else {
      await expect(page.getByLabel("Cidade", { exact: true })).toHaveValue("serra");
    }
    await page.getByRole("button", { name: "Remover Cidade: Serra", exact: true }).filter({ visible: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.has("city")).toBe(false);
    expect(new URL(page.url()).searchParams.get("q")).toBe(model);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("filtro-cidade.png") });
    await page.getByRole("button", { name: "Limpar filtros", exact: true }).filter({ visible: true }).click();
    await expect.poll(() => new URL(page.url()).search).toBe("");
    expect(errors).toEqual([]);
  } finally {
    await db.vehicle.deleteMany({ where: { id: { in: rows.map(row => row.id) } } });
    await db.$disconnect();
  }
});
