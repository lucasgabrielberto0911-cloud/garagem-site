import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const db = new PrismaClient();
test.afterAll(async () => { await db.$disconnect(); });

test.beforeEach(async ({ context, baseURL }) => {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.origin === new URL(baseURL!).origin ? route.continue() : route.abort();
  });
});

test("login mantém campos legíveis, foco e erro acessível no WebKit", async ({ page }) => {
  await page.route("**/api/auth/login", (route) => route.fulfill({
    status: 401, contentType: "application/json", body: JSON.stringify({ error: "Credenciais inválidas." }),
  }));
  await page.goto("/admin/login");
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
  await page.getByLabel("E-mail", { exact: true }).fill("teste-webkit@local.test");
  const senha = page.getByLabel("Senha", { exact: true });
  await senha.fill("senha-ficticia");
  await expect(senha).toBeFocused();
  expect(await senha.evaluate((input) => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
  await page.getByRole("button", { name: "Mostrar senha", exact: true }).click();
  await expect(senha).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Credenciais inválidas." })).toBeVisible();
  await expect(senha).toHaveValue("senha-ficticia");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("cadastro mantém o preenchimento ao recusar saída pelo navegador", async ({ page, context, baseURL }) => {
  const email = `webkit-${randomUUID()}@local.test`;
  const password = "senha-ficticia-webkit";
  const admin = await db.admin.create({ data: { name: "Teste WebKit", email, passwordHash: await bcrypt.hash(password, 4) } });
  try {
    const login = await page.request.post("/api/auth/login", { data: { email, password } });
    expect(login.status()).toBe(200);
    const cookie = login.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
    await page.goto("/admin");
    await page.goto("/admin/clientes");
    await page.getByRole("button", { name: "Novo cliente", exact: true }).click();
    const nome = page.getByLabel("Nome", { exact: false }).first();
    await nome.fill("Cliente fictício WebKit");
    await expect(nome).toBeFocused();
    expect(await nome.evaluate((input) => parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
    await page.goBack();
    const aviso = page.getByRole("dialog", { name: "Descartar alterações?" });
    await expect(aviso).toBeVisible();
    await aviso.getByRole("button", { name: "Continuar editando", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/clientes$/);
    await expect(nome).toHaveValue("Cliente fictício WebKit");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  } finally {
    await db.adminAudit.deleteMany({ where: { adminId: admin.id } });
    await db.admin.delete({ where: { id: admin.id } });
  }
});
