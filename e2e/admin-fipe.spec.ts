import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
const local = process.env.E2E_TEST === "1" && ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) && ["/ci", "/garagem_e2e"].includes(database.pathname);
const prisma = new PrismaClient();
const quote = {
  vehicle: { brand: "Volkswagen", model: "Golf", version: "1.4 TSI Flex", yearModel: 2020, fuel: "Flex", price: 82400, code: "005001-1", reference: "outubro de 2026" },
  stock: { count: 2, min: 79900, max: 86000, average: 82950 },
};
const test = base.extend<{ vehicleId: string }>({
  vehicleId: async ({ page, context, baseURL }, executar) => {
    const email = `fipe-${randomUUID()}@local.test`;
    const password = "fipe-local-123";
    const admin = await prisma.admin.create({ data: { name: "Teste FIPE", email, passwordHash: await bcrypt.hash(password, 4) } });
    const vehicle = await prisma.vehicle.create({ data: { category: "carro", brand: "Honda", model: "Civic", version: "EX", year: 2019, yearModel: 2020, km: 50000, price: 79900, fuel: "Gasolina", transmission: "Manual", color: "Preto", plate: "ABC1D23" } });
    try {
      await page.route(/\/fotos\/|supabase\.co\/storage\//, route => route.abort());
      await page.route("https://parallelum.com.br/**", () => { throw new Error("O navegador não deve consultar o provedor diretamente."); });
      await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
      await page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}` });
      page.on("dialog", dialog => dialog.accept());
      const login = await page.request.post("/api/auth/login", { data: { email, password } });
      expect(login.ok()).toBeTruthy();
      const cookie = login.headers()["set-cookie"].split(";")[0];
      await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax", secure: false }]);
      await executar(vehicle.id);
    } finally {
      await prisma.adminDraft.deleteMany({ where: { adminId: admin.id } });
      await prisma.vehicle.delete({ where: { id: vehicle.id } });
      await prisma.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await prisma.admin.delete({ where: { id: admin.id } });
    }
  },
});
test.skip(!local, "Requer banco local dedicado.");
test.afterAll(async () => { await prisma.$disconnect(); });

async function step(page: Page, number: number) {
  await expect(page.locator('#secao-fotos input[type="file"]')).toBeEnabled();
  await page.getByRole("navigation", { name: "Etapas do anúncio" }).getByRole("button", { name: new RegExp(`^${number}\\.`) }).click();
  await expect(page.locator("#wizard-title")).toContainText(`Etapa ${number} de 4`);
}

async function mockFipe(page: Page, failFirst = false) {
  let failed = false;
  await page.route("**/api/admin/fipe?**", route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.has("plate")).toBe(false);
    expect(route.request().url()).not.toContain("ABC1D23");
    if (failFirst && !failed) { failed = true; return route.fulfill({ status: 502, json: { error: "FIPE indisponível." } }); }
    const data = params.has("year") ? quote : params.has("model") ? [{ codigo: "2020-1", nome: "2020 Flex" }] : params.has("brand") ? [{ codigo: "100", nome: "Golf 1.4 TSI Flex" }] : [{ codigo: "59", nome: "Volkswagen" }];
    return route.fulfill({ json: data });
  });
}

async function choose(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Buscar na FIPE" });
  await dialog.getByLabel("Marca FIPE").selectOption("59");
  await dialog.getByLabel("Modelo FIPE").selectOption("100");
  await dialog.getByLabel("Ano modelo FIPE").selectOption("2020-1");
  await dialog.getByRole("button", { name: "Preencher dados do veículo" }).click();
  await expect(dialog).toBeHidden();
}

test("preenche pela FIPE sem placa, preserva fabricação e exige Usar para alterar preço", async ({ page, vehicleId }) => {
  await mockFipe(page);
  await page.goto(`/admin/veiculos/${vehicleId}`);
  await step(page, 2);
  await page.getByRole("button", { name: "Buscar na FIPE", exact: true }).click();
  await choose(page);
  await expect(page.locator('[name="brand"]')).toHaveValue("Volkswagen");
  await expect(page.locator('[name="model"]')).toHaveValue("Golf");
  await expect(page.locator('[name="version"]')).toHaveValue("1.4 TSI Flex");
  await expect(page.locator('[name="yearModel"]')).toHaveValue("2020");
  await expect(page.locator('[name="year"]')).toHaveValue("2019");
  await expect(page.locator('[name="fuel"]')).toHaveValue("Flex");
  await expect(page.locator('[name="plate"]')).toHaveValue("ABC1D23");
  await step(page, 3);
  await expect(page.locator('[name="priceDisplay"]')).toHaveValue("79.900,00");
  await expect(page.getByText(/estoque parecido \(2\)/)).toBeVisible();
  await page.getByText(/estoque parecido \(2\)/).scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("fipe-preco.png") });
  await page.getByRole("button", { name: /^Usar R\$/ }).click();
  await expect(page.locator('[name="priceDisplay"]')).toHaveValue("82.400,00");
  await step(page, 2);
  await page.locator('[name="yearModel"]').fill("2021");
  await step(page, 3);
  await expect(page.getByRole("button", { name: /^Usar R\$/ })).toBeHidden();
  await expect(page.getByRole("button", { name: "Consultar referência FIPE" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("consulta só abre por intenção, recupera falha e fecha com Escape", async ({ page, vehicleId }) => {
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("/api/admin/fipe?")) requests.push(request.url()); });
  await mockFipe(page, true);
  await page.goto(`/admin/veiculos/${vehicleId}`);
  await step(page, 3);
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(requests).toHaveLength(0);
  await page.getByRole("button", { name: "Consultar referência FIPE" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "FIPE indisponível" })).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await choose(page);
  await expect(page.locator('[name="priceDisplay"]')).toHaveValue("79.900,00");
  await step(page, 2);
  await page.getByRole("button", { name: "Buscar na FIPE", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
