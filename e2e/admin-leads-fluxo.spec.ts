import { test as base, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID, randomInt } from "node:crypto";
import { ORIGIN_LABELS } from "../src/lib/lead-origin";
import { weeklyLeadSummary } from "../src/lib/lead-funnel";
import { vehiclePath } from "../src/lib/vehicle-slug";
import samples from "./public-samples.json";

// playwright.config.ts exige banco local dedicado e notificações desativadas.
const prisma = new PrismaClient();
const password = "senha-ficticia-e2e-123";
const test = base.extend<{ conta: { email: string; prefixo: string }; destinos: string[] }>({
  conta: async ({ page }, executar) => {
    const prefixo = `E2E-${randomUUID()}`;
    const email = `${prefixo}@local.test`.toLowerCase();
    const admin = await prisma.admin.create({ data: { name: prefixo, email, passwordHash: await bcrypt.hash(password, 4) } });
    await page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}` });
    await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
    try { await executar({ email, prefixo }); }
    finally {
      await prisma.leadVenda.deleteMany({ where: { name: { startsWith: prefixo } } });
      await prisma.vehicle.deleteMany({ where: { model: { startsWith: prefixo } } });
      await prisma.adminAudit.deleteMany({ where: { adminId: admin.id } });
      await prisma.admin.delete({ where: { id: admin.id } });
    }
  },
  destinos: [async ({ context }, executar) => {
    const destinos: string[] = [];
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.hostname === "127.0.0.1") return route.continue();
      if (url.hostname === "wa.me") destinos.push(url.href);
      await route.fulfill({ status: 200, body: "Interceptado pelo teste local." });
    });
    await executar(destinos);
  }, { auto: true }],
});
test.afterAll(async () => { await prisma.$disconnect(); });

async function login(page: import("@playwright/test").Page, email: string) {
  expect((await page.request.post("/api/auth/login", { data: { email, password } })).status()).toBe(200);
  // APIRequestContext não envia cookie Secure em HTTP, mesmo no loopback.
  const cookie = (await page.context().cookies()).find(item => item.name === "session");
  expect(cookie).toBeTruthy();
  await page.context().addCookies([{ ...cookie!, secure: false }]);
}

test("login: formulário, senha inválida, sessão protegida e logout", async ({ page, conta }) => {
  await page.goto("/admin/leads");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("E-mail", { exact: true }).fill(conta.email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-incorreta");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByText("Credenciais inválidas.")).toBeVisible();
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const cookie = (await page.context().cookies()).find(item => item.name === "session");
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe("Lax");
  expect((await page.request.post("/api/auth/logout")).ok()).toBe(true);
  expect((await page.request.get("/api/admin/leads/veiculos")).status()).toBe(401);
});

test("login: rejeita corpo inválido, origem externa, cookie falso e excesso de tentativas", async ({ page, conta }) => {
  for (const body of ["null", "{", "[]", '{"email":{},"password":[]}',
    JSON.stringify({ email: conta.email }),
    JSON.stringify({ email: "a".repeat(255), password }),
    JSON.stringify({ email: conta.email, password: "a".repeat(257) }),
  ]) {
    const response = await page.request.post("/api/auth/login", { data: body, headers: { "Content-Type": "application/json" } });
    expect(response.status(), body).toBe(400);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  }
  expect((await page.request.post("/api/auth/login", {
    data: "formulário inválido", headers: { "Content-Type": "multipart/form-data" },
  })).status()).toBe(400);
  expect((await page.request.post("/api/auth/login", { data: { email: conta.email, password }, headers: { Origin: "https://externo.test" } })).status()).toBe(403);
  expect((await page.request.get("/api/admin/leads/veiculos", { headers: { Cookie: "session=falso" } })).status()).toBe(401);
  for (let i = 0; i < 8; i++) expect((await page.request.post("/api/auth/login", { data: { email: conta.email, password: "incorreta" } })).status()).toBe(401);
  expect((await page.request.post("/api/auth/login", { data: { email: conta.email, password } })).status()).toBe(429);
});

test("login: trocar a senha invalida a sessão anterior", async ({ page, conta }) => {
  await login(page, conta.email);
  await prisma.admin.update({ where: { email: conta.email }, data: { passwordHash: await bcrypt.hash("nova-senha-ficticia", 4) } });
  expect((await page.request.get("/api/admin/leads/veiculos")).status()).toBe(401);
  await page.goto("/admin/leads");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("veículo: cadastrar, editar, marcar vendido e manter ficha sem preço", async ({ page, conta }) => {
  await login(page, conta.email);
  await page.goto("/admin/veiculos/novo");
  const form = page.locator("#vehicle-form");
  async function abrir(label: string) {
    const toggle = form.getByRole("button", { name: new RegExp(`^${label}`) }).first();
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  }
  await abrir("Identificação");
  await form.locator('[name="brand"]').fill("Honda");
  await form.locator('[name="model"]').fill(conta.prefixo);
  await form.locator('[name="color"]').fill("Prata");
  await abrir("Preço e status");
  await form.locator('[name="priceDisplay"]').fill(" R$ 87.654,00 ");
  await form.getByRole("button", { name: "Linhares ES", exact: true }).click();
  await abrir("Ficha técnica");
  await form.locator('[name="year"]').fill(" 2020 ");
  await form.locator('[name="yearModel"]').fill("2021");
  await form.locator('[name="kmDisplay"]').fill("-42000");
  await form.locator('[name="fuel"]').selectOption({ label: "Flex" });
  await form.locator('[name="transmission"]').selectOption({ label: "Manual" });
  await page.getByRole("button", { name: "Cadastrar veículo", exact: true }).click();
  await expect(form.getByText("Informe KM inteiro entre 0 e 999.999.", { exact: true })).toBeVisible();
  await form.locator('[name="kmDisplay"]').fill("42.000 km");
  await expect(form.getByText("Informe KM inteiro entre 0 e 999.999.", { exact: true })).toHaveCount(0);
  await abrir("Identificação");
  await form.locator('[name="plate"]').fill("abc-1234");
  await expect(form.locator('[name="plate"]')).toHaveAttribute("autocorrect", "off");
  await page.getByRole("button", { name: "Cadastrar veículo", exact: true }).click();
  await expect.poll(() => prisma.vehicle.count({ where: { model: conta.prefixo } })).toBe(1);
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { model: conta.prefixo } });
  expect(vehicle.price).toBe(87654);
  expect(vehicle.km).toBe(42000);
  expect(vehicle.plate).toBe("ABC1234");
  expect(vehicle.doors).toBeNull();
  expect(vehicle.purchasePrice).toBeNull();
  await expect(page).toHaveURL(`/admin/veiculos/${vehicle.id}`);
  await page.locator('[name="priceDisplay"]').fill("86543.50");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect.poll(async () => (await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).price).toBe(86543.5);
  await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
  // Uma falha no servidor após salvar não pode perder a versão usada no próximo save.
  await form.locator('[name="photoUrls"]').evaluate((input: HTMLInputElement) => { input.value = "{"; });
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByText("Fotos inválidas.", { exact: true })).toBeVisible();
  await form.locator('[name="photoUrls"]').evaluate((input: HTMLInputElement) => { input.value = "[]"; });
  await form.locator('[name="priceDisplay"]').fill("85.900");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect.poll(async () => (await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).price).toBe(85900);
  await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
  const maisAcoes = page.getByRole("button", { name: "Mais ações do anúncio", exact: true });
  if (await maisAcoes.isVisible()) await maisAcoes.click();
  await page.getByRole("button", { name: /^Marcar vendido/ }).click();
  await page.getByRole("button", { name: "Só marcar vendido", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/veiculos\?tab=vendidos$/);
  await expect.poll(async () => (await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).status).toBe("vendido");
  await page.goto(vehiclePath(vehicle));
  await expect(page.locator("main")).toContainText(/vendido/i);
  await expect(page.locator("main")).not.toContainText(/86\.543|87\.654/);
  const structured = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(structured.join(" ")).not.toMatch(/"price"\s*:/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("funil: registrar origens, filtrar e persistir etapas e encerramento", async ({ page, conta }) => {
  await login(page, conta.email);
  await page.goto("/admin/leads");
  const details = page.locator("details").filter({ has: page.locator("summary", { hasText: "+ Registrar conversa do WhatsApp" }) });
  await details.locator("summary").click();
  const form = details.locator("form");
  for (const origin of Object.keys(ORIGIN_LABELS)) {
    await form.locator('[name="name"]').fill(`${conta.prefixo}-${origin}`);
    await form.locator('[name="phone"]').fill("27988887766");
    await form.locator('[name="origin"]').selectOption(origin);
    await form.locator('[name="nextAction"]').fill("Confirmar visita");
    await form.locator('[name="date"]').fill("2026-12-01");
    await form.getByRole("button", { name: /Registrar/ }).click();
    await expect.poll(() => prisma.leadVenda.count({ where: { name: `${conta.prefixo}-${origin}`, source: `whatsapp:${origin}` } })).toBe(1);
    await expect(form.getByRole("button", { name: /Registrar/ })).toBeEnabled();
  }
  const lead = await prisma.leadVenda.findFirstOrThrow({ where: { name: `${conta.prefixo}-google` } });
  await page.getByLabel("Filtrar origem").selectOption("whatsapp:google");
  await expect(page).toHaveURL(/origem=whatsapp%3Agoogle/);
  await expect(page.locator(`#lead-${lead.id}`)).toBeVisible();
  await expect(page.locator("li[id^='lead-']")).not.toContainText(`${conta.prefixo}-instagram`);
  await page.goto(`/admin/leads?lead=${lead.id}`);
  const card = page.locator(`#lead-${lead.id}`);
  for (const status of ["visita-marcada", "visitou", "fechado"]) {
    await card.getByLabel("Status do lead").selectOption(status);
    await expect.poll(async () => (await prisma.leadVenda.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe(status);
    await expect(card.getByLabel("Status do lead")).toBeEnabled();
  }
  const saved = await prisma.leadVenda.findUniqueOrThrow({ where: { id: lead.id }, include: { activities: true } });
  expect(saved.nextAction).toBeNull();
  expect(saved.nextActionAt).toBeNull();
  expect(weeklyLeadSummary([saved]).sources[0]).toMatchObject({ label: "Google", conversas: 1, marcadas: 1, visitas: 1, vendas: 1 });
  await page.reload();
  await expect(page.locator(`#status-${lead.id}`)).toHaveValue("fechado");
});

test("alerta desejado: consentimento, gravação, correspondência e encerramento", async ({ page, conta }) => {
  await login(page, conta.email);
  expect((await page.request.get("/api/admin/avisos?tipo=pedidos")).status()).toBe(200);
  await page.request.post("/api/auth/logout");
  await page.goto("/pedido?q=Honda%20Civic");
  const form = page.locator("[data-missing-model-form] form");
  await form.locator('[name="phone"]').fill("27988887766");
  await form.locator('[name="name"]').fill(conta.prefixo);
  await form.getByRole("button", { name: "Enviar pedido", exact: true }).click();
  expect(await prisma.leadVenda.count({ where: { name: conta.prefixo } })).toBe(0);
  await form.getByRole("checkbox", { name: /Autorizo/ }).check();
  await form.getByRole("button", { name: "Enviar pedido", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pedido recebido" })).toBeVisible();
  const lead = await prisma.leadVenda.findFirstOrThrow({ where: { name: conta.prefixo } });
  expect(lead.source).toBe("nao-encontrou");
  await login(page, conta.email);
  const matches = await page.request.get("/api/admin/avisos?tipo=pedidos");
  expect(matches.status()).toBe(200);
  expect((await matches.json()).items.some((item: { id: string }) => item.id.startsWith(`${lead.id}:`))).toBe(true);
  await page.goto(`/admin/leads?lead=${lead.id}`);
  await page.locator(`#status-${lead.id}`).selectOption("perdido");
  await expect.poll(async () => (await prisma.leadVenda.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("perdido");
  const after = await (await page.request.get("/api/admin/avisos?tipo=pedidos")).json();
  expect(after.items.some((item: { id: string }) => item.id.startsWith(`${lead.id}:`))).toBe(false);
});

test("avaliação: formulário salva lead com origem e mostra recibo", async ({ page, conta }) => {
  await login(page, conta.email);
  expect((await page.request.get("/api/admin/badge")).status()).toBe(200);
  await page.request.post("/api/auth/logout");
  await page.goto(`/vender?interesse=${samples[0].id}`);
  const form = page.locator("form").filter({ has: page.locator('[name="plate"]') });
  for (const [field, value] of Object.entries({ name: conta.prefixo, phone: "27988887766", brand: "Honda", model: "Civic", year: "2020", plate: "ABC1D23", km: "42000", notes: "Avaliação fictícia" })) {
    await form.locator(`[name="${field}"]`).fill(value);
  }
  await form.getByRole("button", { name: "Solicitar avaliação", exact: true }).click();
  await expect.poll(() => prisma.leadVenda.count({ where: { name: conta.prefixo } })).toBe(1);
  const lead = await prisma.leadVenda.findFirstOrThrow({ where: { name: conta.prefixo } });
  expect(lead).toMatchObject({ source: "vender", status: "novo", plate: "ABC1D23", km: 42000, interestVehicleId: samples[0].id });
  await expect(page.locator("#sell-form-receipt-heading")).toBeVisible();
  await login(page, conta.email);
  const badge = await (await page.request.get("/api/admin/badge")).json();
  expect(badge.count).toBe(await prisma.leadVenda.count({ where: { status: "novo" } }));
});

test("WhatsApp: clique interceptado conserva veículo, origem e eventos do catálogo", async ({ page, destinos }) => {
  await page.addInitScript(() => {
    localStorage.setItem("garagem_consent", "accepted");
    (window as unknown as { fbq: unknown }).fbq = (...args: unknown[]) => {
      const target = window as unknown as { eventosE2E: unknown[][] };
      (target.eventosE2E ??= []).push(args);
    };
  });
  await page.goto(`${vehiclePath(samples[0])}?utm_source=instagram`);
  const link = page.viewportSize()!.width < 1024
    ? page.getByRole("link", { name: /^Tenho interesse no WhatsApp/ })
    : page.locator('[data-ficha-page] aside').getByRole("link", { name: "Tenho interesse", exact: true });
  await link.click();
  await expect.poll(() => destinos.length).toBe(1);
  const message = new URL(destinos[0]).searchParams.get("text");
  expect(message).toContain(samples[0].model);
  expect(message).toContain("Vim pelo Instagram.");
  const events = await page.evaluate(() => (window as unknown as { eventosE2E: unknown[][] }).eventosE2E);
  for (const name of ["AddToCart", "Lead"]) expect(events).toContainEqual(["track", name, expect.objectContaining({ content_ids: [samples[0].id], content_type: "vehicle" })]);
});
