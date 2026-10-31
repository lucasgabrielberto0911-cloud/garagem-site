import { test as base, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
const localDatabase =
  process.env.E2E_TEST === "1" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) &&
  ["/ci", "/garagem_e2e"].includes(database.pathname);
const prisma = new PrismaClient();

const test = base.extend<{ tag: string }>({
  tag: async ({ page, context, baseURL }, run) => {
    const id = randomUUID();
    const tag = `Lote${id.slice(0, 8)}`;
    const email = `lista-lote-${id}@local.test`;
    const password = "lista-lote-local-123";
    const admin = await prisma.admin.create({
      data: { name: "Teste lista", email, passwordHash: await bcrypt.hash(password, 4) },
    });
    const base = {
      brand: tag,
      category: "carro",
      year: 2021,
      yearModel: 2022,
      km: 30000,
      fuel: "Flex",
      transmission: "Automático",
      color: "Branco",
      locationCity: "linhares",
      description: "Veículo revisado.",
      accessories: [],
    };
    await prisma.vehicle.createMany({
      data: [
        { ...base, model: "Alfa", price: 50000, status: "disponivel" },
        { ...base, model: "Beta", price: 0, status: "disponivel" },
        { ...base, model: "Gama", price: 60000, status: "disponivel" },
      ],
    });
    try {
      await page.route("**/fotos/**", (route) => route.abort());
      await page.route("https://*.supabase.co/**", (route) => route.abort());
      await page.setExtraHTTPHeaders({
        "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}`,
      });
      const login = await page.request.post("/api/auth/login", { data: { email, password } });
      expect(login.ok()).toBeTruthy();
      const cookie = login.headers()["set-cookie"].split(";")[0];
      await context.addCookies([
        {
          name: "session",
          value: cookie.slice("session=".length),
          url: baseURL!,
          httpOnly: true,
          sameSite: "Lax",
          secure: false,
        },
      ]);
      await run(tag);
    } finally {
      await prisma.vehicle.deleteMany({ where: { brand: tag } });
      await prisma.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await prisma.admin.delete({ where: { id: admin.id } });
    }
  },
});
test.skip(!localDatabase, "Requer banco local dedicado e E2E_TEST=1.");
test.afterAll(async () => prisma.$disconnect());

test("lista limpa: sem checkbox, sem filtros abertos e sem barra de lote", async ({ page, tag }) => {
  await page.goto(`/admin/veiculos?q=${tag}`);
  await expect(page.getByText(`${tag} Alfa`)).toBeVisible();
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Filtros" })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("group", { name: "Pendências do estoque" })).toHaveCount(0);
  await expect(page.getByText("selecionado(s)")).toHaveCount(0);
});

test("filtro sem preço fica na URL e vira chip removível", async ({ page, tag }) => {
  await page.goto(`/admin/veiculos?q=${tag}`);
  await page.getByRole("button", { name: "Filtros" }).click();
  await page.getByRole("group", { name: "Pendências do estoque" }).getByRole("button", { name: "Sem preço" }).click();
  await expect(page).toHaveURL(/pendencia=sem-preco/);
  await expect(page.getByText(`${tag} Beta`)).toBeVisible();
  await expect(page.getByText(`${tag} Alfa`)).toHaveCount(0);
  await page.getByRole("button", { name: "Remover filtro Sem preço" }).click();
  await expect(page).not.toHaveURL(/pendencia/);
  await expect(page.getByText(`${tag} Alfa`)).toBeVisible();
});

test("selecionar mostra a barra de lote e destaca em lote; Esc cancela", async ({ page, tag }) => {
  await page.goto(`/admin/veiculos?q=${tag}`);
  await page.getByRole("button", { name: "Selecionar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Destacar", exact: true })).toHaveCount(0);
  await page.getByLabel(`Selecionar ${tag} Alfa`).check();
  await page.getByLabel(`Selecionar ${tag} Gama`).check();
  await expect(page.getByRole("button", { name: "Destacar", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Destacar", exact: true }).click();
  await expect
    .poll(() => prisma.vehicle.count({ where: { brand: tag, featured: true } }))
    .toBe(2);
  await page.keyboard.press("Escape");
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
});

test("atalhos: / foca a busca e ? lista os atalhos", async ({ page, tag }) => {
  await page.goto(`/admin/veiculos?q=${tag}`);
  await page.locator("body").press("/");
  await expect(page.getByRole("searchbox", { name: /Buscar/ })).toBeFocused();
  await page.locator("body").press("Escape");
  await page.keyboard.press("Shift+/");
  await expect(page.getByText("Atalhos do teclado")).toBeVisible();
});
