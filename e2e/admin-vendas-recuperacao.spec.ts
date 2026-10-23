import { test as base, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID } from "node:crypto";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
const localDatabase = process.env.E2E_TEST === "1" &&
  ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) &&
  ["/ci", "/garagem_e2e"].includes(database.pathname);
const db = new PrismaClient();
const test = base.extend<{ vehicle: { id: string; model: string } }>({
  vehicle: async ({ page, context, baseURL }, executar) => {
    const suffix = randomUUID();
    const email = `recuperacao-${suffix}@local.test`;
    const password = "recuperacao-local-123";
    const admin = await db.admin.create({ data: {
      name: "Teste de recuperação", email, passwordHash: await bcrypt.hash(password, 4),
    } });
    const vehicle = await db.vehicle.create({ data: {
      brand: "Volkswagen", model: `Recuperação ${suffix}`, year: 2022, yearModel: 2023,
      km: 20000, price: 80000, fuel: "Flex", transmission: "Automático", featured: true,
      costs: { create: { kind: "mecanica", amount: 250, description: "Revisão de teste" } },
    } });
    try {
      await page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}` });
      const login = await page.request.post("/api/auth/login", { data: { email, password } });
      expect(login.ok()).toBeTruthy();
      const cookie = login.headers()["set-cookie"].split(";")[0];
      await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
      await executar(vehicle);
    } finally {
      const sale = await db.sale.findUnique({ where: { vehicleId: vehicle.id } });
      await db.sale.deleteMany({ where: { vehicleId: vehicle.id } });
      await db.vehicle.delete({ where: { id: vehicle.id } });
      if (sale?.customerId) await db.customer.delete({ where: { id: sale.customerId } });
      await db.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await db.admin.delete({ where: { id: admin.id } });
    }
  },
});
test.skip(!localDatabase, "Requer banco local dedicado e E2E_TEST=1.");
test.afterAll(async () => { await db.$disconnect(); });

async function openSimpleSale(page: Page, vehicle: { model: string }) {
  await page.goto(`/admin/veiculos?q=${encodeURIComponent(vehicle.model)}`);
  await page.getByRole("button", { name: "Marcar como vendida (simples)", exact: true }).click();
  return page.getByRole("dialog", { name: "Marcar como vendida (simples)" });
}

async function expectSale(vehicleId: string, price: number) {
  const vehicle = await db.vehicle.findUniqueOrThrow({
    where: { id: vehicleId }, include: { sale: { include: { customer: true, afterSaleTasks: true } }, costs: true },
  });
  expect(vehicle.status).toBe("vendido");
  expect(vehicle.featured).toBe(false);
  expect(vehicle.sale?.salePrice).toBe(price);
  expect(vehicle.sale?.customer?.name).toBe("Comprador de teste");
  expect(vehicle.sale?.saleDate).toBeInstanceOf(Date);
  expect(vehicle.sale?.afterSaleTasks).toHaveLength(4);
  expect(vehicle.costs.map(cost => cost.amount)).toEqual([250]);
  return vehicle.sale!;
}

test("listagem abre anúncio e operação sem erro", async ({ page, vehicle }) => {
  const list = await page.request.get(`/api/admin/veiculos?q=${encodeURIComponent(vehicle.model)}`);
  expect(list.status()).toBe(200);
  await page.goto(`/admin/veiculos?q=${encodeURIComponent(vehicle.model)}`);
  await page.getByRole("link", { name: "Editar", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/veiculos/${vehicle.id}$`));
  await expect(page.getByRole("heading", { name: `Volkswagen ${vehicle.model}`, exact: true })).toBeVisible();
  await expect(page.locator('[name="model"]')).toHaveValue(vehicle.model);
  await page.getByRole("link", { name: /^Custos e docs/ }).click();
  await expect(page.getByText("Mecânica / revisão · Revisão de teste", { exact: true })).toBeVisible();
});

test("venda simples fecha modal, preserva custos e não gera faturamento", async ({ page, vehicle }) => {
  const dialog = await openSimpleSale(page, vehicle);
  const response = page.waitForResponse(response => response.url().endsWith(`/api/admin/vehicles/${vehicle.id}/sell`));
  await dialog.getByRole("button", { name: "Marcar como vendida (simples)", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(dialog).toBeHidden();
  const saved = await db.vehicle.findUniqueOrThrow({ where: { id: vehicle.id }, include: { sale: true, costs: true } });
  expect(saved.status).toBe("vendido");
  expect(saved.featured).toBe(false);
  expect(saved.sale).toBeNull();
  expect(saved.costs.map(cost => cost.amount)).toEqual([250]);
  expect(await db.commercialDocument.count({ where: { vehicleId: vehicle.id } })).toBe(0);
  expect(await db.adminAudit.count({ where: { entityId: vehicle.id, action: "vehicle.status" } })).toBe(1);
});

test("falha simples fecha confirmação, mantém veículo e permite tentar novamente", async ({ page, vehicle }) => {
  const endpoint = `**/api/admin/vehicles/${vehicle.id}/sell`;
  let attempts = 0;
  await page.route(endpoint, route => {
    attempts++;
    return route.fulfill({ status: 500, json: { ok: false, message: "Não foi possível marcar o veículo como vendido." } });
  }, { times: 1 });
  const dialog = await openSimpleSale(page, vehicle);
  await dialog.getByRole("button", { name: "Marcar como vendida (simples)", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Não foi possível marcar o veículo como vendido.", { exact: true })).toBeVisible();
  expect(attempts).toBe(1);
  expect((await db.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).status).toBe("disponivel");
  expect(await db.sale.count({ where: { vehicleId: vehicle.id } })).toBe(0);
  await page.getByRole("button", { name: "Marcar como vendida (simples)", exact: true }).click();
  await dialog.getByRole("button", { name: "Marcar como vendida (simples)", exact: true }).click();
  await expect.poll(async () => (await db.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).status).toBe("vendido");
  await expect(dialog).toBeHidden();
});

test("API completa registra comprador, valor e pós-venda atomicamente", async ({ page, vehicle }) => {
  const response = await page.request.patch(`/api/admin/vehicles/${vehicle.id}/sell`, { data: {
    buyerName: "Comprador de teste", buyerPhone: "27988887777", salePrice: 78000, paymentMethod: "Pix",
  } });
  expect(response.status()).toBe(200);
  const sale = await expectSale(vehicle.id, 78000);
  expect((await response.json()).saleId).toBe(sale.id);
  expect((await page.request.patch(`/api/admin/vehicles/${vehicle.id}/sell`, { data: {} })).status()).toBe(409);
  expect(await db.sale.count({ where: { vehicleId: vehicle.id } })).toBe(1);
});

test("fluxo completo preserva campos após falha, sem abrir venda simples, e grava contrato", async ({ page, vehicle }) => {
  await page.goto(`/admin/veiculos?q=${encodeURIComponent(vehicle.model)}`);
  await page.getByRole("button", { name: "Registrar venda completa", exact: true }).click();
  await page.getByRole("dialog", { name: "Registrar venda completa" }).getByRole("button", { name: "Registrar venda completa", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/vendas/nova\\?veiculo=${vehicle.id}`));
  await expect(page.getByRole("dialog", { name: "Marcar como vendida (simples)" })).toBeHidden();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Cadastrar cliente nesta venda").check();
  await page.getByLabel("Nome", { exact: true }).fill("Comprador de teste");
  await page.getByLabel("Telefone", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Valor total negociado").fill("78.000,00");
  await page.getByRole("button", { name: /À vista\/PIX/ }).click();
  await page.getByLabel("Valor", { exact: true }).fill("78.000,00");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Responsável comercial").fill("Vendedor de teste");
  await page.getByLabel("Comissão (R$)").fill("0");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
  await expect(page.getByText("Informe nome e telefone válidos do comprador.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Marcar como vendida (simples)" })).toBeHidden();
  expect(await db.sale.count({ where: { vehicleId: vehicle.id } })).toBe(0);
  expect((await db.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).status).toBe("disponivel");
  for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Comprador de teste");
  await page.getByLabel("Telefone", { exact: true }).fill("27988887777");
  for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
  await expect(page.getByRole("heading", { name: "Venda registrada", exact: true })).toBeVisible();
  const sale = await expectSale(vehicle.id, 78000);
  const contract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: vehicle.id, kind: "contrato" } });
  expect(contract.snapshot).toMatchObject({ saleId: sale.id, total: 78000, customerId: sale.customerId });
  await page.getByRole("link", { name: "Ver venda", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/vendas\\?venda=${sale.id}`));
});
