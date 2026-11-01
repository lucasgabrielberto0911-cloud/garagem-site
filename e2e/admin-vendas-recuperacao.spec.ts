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
      await db.commercialDocument.deleteMany({ where: { vehicleId: vehicle.id } });
      await db.vehicleReservation.deleteMany({ where: { vehicleId: vehicle.id } });
      await db.vehicle.delete({ where: { id: vehicle.id } });
      if (sale?.customerId) await db.customer.delete({ where: { id: sale.customerId } });
      await db.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await db.adminDraft.deleteMany({ where: { adminId: admin.id } });
      await db.admin.delete({ where: { id: admin.id } });
    }
  },
});
test.beforeEach(async ({ context }) => {
  await context.route("**/fotos/**", route => route.fulfill({ path: "public/branding/placeholder-car.png", contentType: "image/png" }));
  await context.route("**/_next/image?**", route => route.fulfill({ path: "public/branding/placeholder-car.png", contentType: "image/png" }));
  await context.route("**/*.supabase.co/storage/**", route => route.abort());
});

test.skip(!localDatabase, "Requer banco local dedicado e E2E_TEST=1.");
test.afterAll(async () => { await db.$disconnect(); });

async function openSimpleSale(page: Page, vehicle: { model: string }) {
  await page.goto(`/admin/veiculos?q=${encodeURIComponent(vehicle.model)}`);
  await page.getByRole("button", { name: "Marcar como vendida (simples)", exact: true }).click();
  return page.getByRole("dialog", { name: "Marcar como vendida (simples)" });
}

async function advanceSale(page: Page, heading: string) {
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
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

test("venda rápida reaproveita cliente de mesmo nome e telefone, sem duplicar", async ({ page, vehicle }) => {
  const phone = `279${randomInt(10_000_000, 99_999_999)}`;
  const existing = await db.customer.create({ data: { name: "Comprador de teste", phone } });
  const response = await page.request.patch(`/api/admin/vehicles/${vehicle.id}/sell`, { data: {
    buyerName: "Comprador de teste", buyerPhone: phone, salePrice: 78000, paymentMethod: "Pix",
  } });
  expect(response.status()).toBe(200);
  expect(await db.customer.count({ where: { phone } })).toBe(1);
  expect((await db.sale.findUniqueOrThrow({ where: { vehicleId: vehicle.id } })).customerId).toBe(existing.id);
});

test("venda rápida com telefone de outro nome é recusada e manda para o assistente", async ({ page, vehicle }) => {
  const phone = `279${randomInt(10_000_000, 99_999_999)}`;
  const other = await db.customer.create({ data: { name: "Outra pessoa de teste", phone } });
  try {
    const response = await page.request.patch(`/api/admin/vehicles/${vehicle.id}/sell`, { data: {
      buyerName: "Comprador de teste", buyerPhone: phone, salePrice: 78000, paymentMethod: "Pix",
    } });
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, nextUrl: `/admin/vendas/nova?veiculo=${vehicle.id}` });
    expect(await db.sale.count({ where: { vehicleId: vehicle.id } })).toBe(0);
    expect((await db.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).status).toBe("disponivel");
  } finally {
    await db.customer.delete({ where: { id: other.id } });
  }
});

test("reserva com sinal na venda rápida manda para o assistente", async ({ page, vehicle }) => {
  const customer = await db.customer.create({ data: { name: "Reserva de teste", phone: `279${randomInt(10_000_000, 99_999_999)}` } });
  await db.vehicleReservation.create({ data: { vehicleId: vehicle.id, customerId: customer.id, deposit: 1000, expiresAt: new Date(Date.now() + 86_400_000) } });
  try {
    const response = await page.request.patch(`/api/admin/vehicles/${vehicle.id}/sell`, { data: {} });
    expect(response.status()).toBe(409);
    expect(await response.json()).toMatchObject({ ok: false, nextUrl: `/admin/vendas/nova?veiculo=${vehicle.id}` });
    expect(await db.sale.count({ where: { vehicleId: vehicle.id } })).toBe(0);
  } finally {
    await db.vehicleReservation.deleteMany({ where: { vehicleId: vehicle.id } });
    await db.customer.delete({ where: { id: customer.id } });
  }
});

test("fluxo completo valida cada etapa, preserva campos ao voltar, sem abrir venda simples, e grava contrato", async ({ page, vehicle }) => {
  test.setTimeout(90_000);
  await page.goto(`/admin/veiculos?q=${encodeURIComponent(vehicle.model)}`);
  await page.getByRole("button", { name: "Registrar venda completa", exact: true }).click();
  await page.getByRole("dialog", { name: "Registrar venda completa" }).getByRole("button", { name: "Registrar venda completa", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/vendas/nova\\?veiculo=${vehicle.id}`));
  await expect(page.getByRole("dialog", { name: "Marcar como vendida (simples)" })).toBeHidden();
  await advanceSale(page, "Cliente");
  await page.getByLabel("Cadastrar cliente nesta venda").check();
  await page.getByLabel("Nome", { exact: true }).fill("Comprador de teste");
  await page.getByLabel("Telefone", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "telefone do comprador com DDD" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cliente", exact: true })).toBeVisible();
  await page.getByLabel("Telefone", { exact: true }).fill("27988887777");
  await expect(page.getByLabel("Telefone", { exact: true })).toHaveValue("(27) 98888-7777");
  await advanceSale(page, "Pagamento");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Escolha pelo menos uma forma de pagamento" })).toBeVisible();
  await page.getByLabel("Valor total negociado").fill("78.000,00");
  await page.getByRole("button", { name: /À vista\/PIX/ }).click();
  await page.getByLabel("Valor", { exact: true }).fill("78.000,00");
  await page.getByLabel("Valor", { exact: true }).blur();
  await advanceSale(page, "Vendedor");
  await page.getByLabel("Responsável comercial").fill("Vendedor de teste");
  await page.getByLabel("Comissão (R$)").fill("0");
  await advanceSale(page, "Revisar e gerar contrato");
  expect(await db.sale.count({ where: { vehicleId: vehicle.id } })).toBe(0);
  for (const heading of ["Vendedor", "Pagamento", "Cliente"]) {
    await page.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Comprador de teste");
  for (const heading of ["Pagamento", "Vendedor", "Revisar e gerar contrato"]) await advanceSale(page, heading);
  await page.getByRole("button", { name: "Gerar contrato e registrar venda" }).click();
  await expect(page.getByRole("heading", { name: "Venda registrada", exact: true })).toBeVisible();
  const sale = await expectSale(vehicle.id, 78000);
  const contract = await db.commercialDocument.findFirstOrThrow({ where: { vehicleId: vehicle.id, kind: "contrato" } });
  expect(contract.snapshot).toMatchObject({ saleId: sale.id, total: 78000, customerId: sale.customerId });
  await page.getByRole("link", { name: "Ver venda", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/vendas\\?venda=${sale.id}`));
});
