import { test, expect, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { MATCH_DISMISSED_ACTION, wantedStockMatch } from "../src/lib/wanted-stock-match";
import { WANTED_LEAD_SOURCE } from "../src/lib/leads";
import { PrismaClient } from "@prisma/client";

const database = new URL(process.env.DATABASE_URL || "postgresql://invalid/");
// Depende das fixtures do seed da auditoria (banco local garagem_e2e na porta 5544).
// No CI (banco `ci`) o arquivo é pulado em vez de derrubar a suíte inteira.
const auditDatabase = database.port === "5544" && database.pathname === "/garagem_e2e" && ["localhost", "127.0.0.1"].includes(database.hostname);
if (auditDatabase && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.JEV_API_KEY)) throw new Error("Desligue Storage e Jev externos para esta auditoria.");
test.skip(!auditDatabase, "Requer o banco local da auditoria com o seed do admin.");
const prisma = new PrismaClient();
const vehicleId = "cmubrhzwf0000l304geveibp1";

test.beforeEach(async ({ request, context, baseURL }) => {
  const login = await request.post("/api/auth/login", { data: { email: "audit@local.test", password: "audit-local-123" } });
  expect(login.ok()).toBeTruthy();
  const cookie = login.headers()["set-cookie"].split(";")[0];
  await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
});
test.afterAll(async () => { await prisma.$disconnect(); });

async function revisarAnuncio(page: Page) {
  const nav = page.getByRole("navigation", { name: "Etapas do anúncio" });
  for (const etapa of [1, 2, 3]) {
    await expect(page.locator("#wizard-title")).toContainText(`Etapa ${etapa} de 4`);
    await nav.getByRole("button", { name: "Próximo", exact: true }).click();
  }
  await expect(page.locator("#wizard-title")).toContainText("Etapa 4 de 4");
}

async function savePhotos(page: Page, photos: unknown[]) {
  await page.goto(`/admin/veiculos/${vehicleId}`);
  await expect(page.locator("#vehicle-form")).toBeVisible();
  await revisarAnuncio(page);
  await page.locator('input[name="photoUrls"]').evaluate((element, value) => {
    (element as HTMLInputElement).value = JSON.stringify(value);
  }, photos);
  const before = (await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).updatedAt.toISOString();
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect.poll(async () => (await prisma.vehicle.findUniqueOrThrow({ where: { id: vehicleId } })).updatedAt.toISOString()).not.toBe(before);
}

test("paginação inválida e limites não causam 500", async ({ page }) => {
  const request = page.request;
  for (const value of ["Infinity", "NaN", "-8", "2.9", "", "1e100", "0"]) {
    for (const route of ["/api/admin/veiculos", "/api/admin/vendas", "/api/admin/leads/veiculos"]) {
      const response = await request.get(`${route}?page=${value}&pageSize=${value}`);
      expect(response.status(), `${route}: ${value}`).toBe(200);
      const body = await response.json();
      if (body.page) expect(Number.isInteger(body.page)).toBeTruthy();
      if (body.pageSize) expect(body.pageSize).toBeLessThanOrEqual(route.includes("vendas") ? 80 : 50);
    }
    const response = await request.get(`/admin/leads?page=${value}`);
    expect(response.status()).toBe(200);
  }
  expect((await request.get("/admin/leads?page=Infinity&page=2")).status()).toBe(200);
});

test("opções limitadas recuperam vendido por ID e exigem sessão", async ({ page, playwright, baseURL }) => {
  const request = page.request;
  const response = await request.get("/api/admin/leads/veiculos?q=Honda");
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const body = await response.json();
  expect(body.items.length).toBeLessThanOrEqual(20);
  expect(body.items.every((item: { label: string }) => item.label.includes("Honda"))).toBeTruthy();
  const sold = await prisma.vehicle.findFirstOrThrow({ where: { status: "vendido" }, select: { id: true } });
  const selected = await (await request.get(`/api/admin/leads/veiculos?id=${sold.id}`)).json();
  expect(selected.items).toHaveLength(1);
  expect(selected.items[0].label).toContain("(vendido)");
  const anonymous = await playwright.request.newContext({ baseURL });
  try { expect((await anonymous.get("/api/admin/leads/veiculos")).status()).toBe(401); }
  finally { await anonymous.dispose(); }
});

test("salvar preserva IDs, ordem, foto transformada e retira apenas vínculos excluídos", async ({ page }) => {
  const original = await prisma.photo.findMany({ where: { vehicleId }, orderBy: { order: "asc" } });
  const verified = await prisma.vehicleVerifiedInfo.findUniqueOrThrow({ where: { vehicleId } });
  const score = await prisma.vehicleListingScore.findUniqueOrThrow({ where: { vehicleId } });
  const items = verified.items as Array<{ photoIds: string[] }>;
  const linkedId = items.flatMap(item => item.photoIds)[0];
  try {
    // O contrato legado sem ID também precisa continuar íntegro.
    await savePhotos(page, original.map(({ url, thumbnailUrl }) => ({ url, thumbnailUrl })));
    expect((await prisma.photo.findMany({ where: { vehicleId }, orderBy: { order: "asc" } })).map(photo => photo.id)).toEqual(original.map(photo => photo.id));
    const changed = [...original].reverse().map(photo => ({ id: photo.id, url: photo.url, thumbnailUrl: photo.thumbnailUrl }));
    changed[0].url += "?transformacao-local=1";
    await savePhotos(page, changed);
    const reordered = await prisma.photo.findMany({ where: { vehicleId }, orderBy: { order: "asc" } });
    expect(reordered.map(photo => photo.id)).toEqual(changed.map(photo => photo.id));
    expect(reordered[0].url).toBe(changed[0].url);
    expect((await prisma.vehicleVerifiedInfo.findUniqueOrThrow({ where: { vehicleId } })).items).toEqual(verified.items);
    const remaining = changed.filter(photo => photo.id !== linkedId);
    await savePhotos(page, remaining);
    const after = await prisma.vehicleVerifiedInfo.findUniqueOrThrow({ where: { vehicleId } });
    expect(after.items).toEqual(items.map(item => ({ ...item, photoIds: item.photoIds.filter(id => id !== linkedId) })));
    const ids = new Set((await prisma.photo.findMany({ where: { vehicleId } })).map(photo => photo.id));
    expect((after.items as typeof items).flatMap(item => item.photoIds).every(id => ids.has(id))).toBeTruthy();
    expect((await prisma.vehicleListingScore.findUniqueOrThrow({ where: { vehicleId } })).updatedAt).toEqual(score.updatedAt);
    // Um formulário desatualizado deve falhar sem alterar as fotos.
    await page.goto(`/admin/veiculos/${vehicleId}`);
    await expect(page.locator("#vehicle-form")).toBeVisible();
    await revisarAnuncio(page);
    await page.locator('input[name="expectedUpdatedAt"]').evaluate(element => { (element as HTMLInputElement).value = "2000-01-01T00:00:00.000Z"; });
    await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
    await expect(page.getByText(/Este anúncio mudou em outro acesso/).first()).toBeVisible();
    expect((await prisma.photo.findMany({ where: { vehicleId } })).map(photo => photo.id).sort()).toEqual([...ids].sort());
  } finally {
    await prisma.$transaction(async tx => {
      await tx.photo.deleteMany({ where: { vehicleId } });
      await tx.photo.createMany({ data: original });
      await tx.vehicleVerifiedInfo.update({ where: { vehicleId }, data: { items: verified.items! } });
    });
  }
});

test("as cinco abas carregam e preservam os controles de cada painel", async ({ page }) => {
  for (let round = 0; round < 3; round++) {
    await page.goto(`/admin/veiculos/${vehicleId}?view=verificado`);
    await expect(page.getByText("Revisões e manutenção", { exact: true }).first()).toBeVisible();
    await expect(page.locator("#vehicle-form")).toHaveCount(0);
    await page.goto(`/admin/veiculos/${vehicleId}?view=operacao`);
    await expect(page.getByTestId("consigned-ops-note")).toBeVisible();
    await expect(page.locator("#vehicle-form")).toHaveCount(0);
    await page.goto(`/admin/veiculos/${vehicleId}?view=venda`);
    await expect(page).toHaveURL(new RegExp(`/admin/vendas/nova\\?veiculo=${vehicleId}`));
    await expect(page.getByRole("heading", { name: "Iniciar venda" })).toBeVisible();
    await page.goto(`/admin/veiculos/${vehicleId}?view=fotos`);
    await expect(page.locator("#vehicle-form")).toBeVisible();
    await expect(page.locator('[name="consigned"]')).toHaveCount(1);
    await page.goto(`/admin/veiculos/${vehicleId}`);
    await expect(page.locator("#vehicle-form")).toBeVisible();
    await expect(page.locator('[name="consigned"]')).toHaveCount(1);
  }
});


test("badge e avisos refletem alteração do atendimento sem esperar o TTL", async ({ page }) => {
  const lead = await prisma.leadVenda.findFirstOrThrow({ where: { status: "novo", source: "vender" } });
  const before = await (await page.request.get("/api/admin/badge")).json();
  const counts = await (await page.request.get("/api/admin/avisos")).json();
  expect(before.notifications).toBe(Object.values(counts.counts as Record<string, number>).reduce((sum, count) => sum + count, 0));
  try {
    await page.goto(`/admin/leads?lead=${lead.id}`);
    await page.locator(`#status-${lead.id}`).selectOption("contatado");
    await expect.poll(async () => (await prisma.leadVenda.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe("contatado");
    await expect.poll(async () => (await (await page.request.get("/api/admin/badge")).json()).count).toBe(before.count - 1);
  } finally {
    await page.locator(`#status-${lead.id}`).selectOption(lead.status);
    await expect.poll(async () => (await prisma.leadVenda.findUniqueOrThrow({ where: { id: lead.id } })).status).toBe(lead.status);
  }
});

test("alerta muda com o hash e a sessão antiga é rejeitada sem cache de autenticação", async ({ page, context, baseURL }) => {
  const admin = await prisma.admin.create({ data: {
    name: "Teste de cache de senha", email: "cache-senha@local.test", passwordHash: await bcrypt.hash("troque-esta-senha", 10),
  } });
  const login = async (password: string) => {
    const response = await page.request.post("/api/auth/login", { data: { email: admin.email, password } });
    expect(response.ok()).toBeTruthy();
    const cookie = response.headers()["set-cookie"].split(";")[0];
    await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax" }]);
  };
  const warning = page.getByText(/Você ainda está usando a senha padrão/);
  try {
    await login("troque-esta-senha");
    await page.goto("/admin/conta");
    await expect(warning).toBeVisible();
    await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash("nova-senha-local-123", 10) } });
    await page.reload();
    await expect(page).toHaveURL(/admin\/login/);
    await login("nova-senha-local-123");
    await page.goto("/admin/conta");
    await expect(warning).toHaveCount(0);
  } finally {
    await prisma.admin.delete({ where: { id: admin.id } });
  }
});


test("matches do aviso mantêm os critérios e a ordem do cálculo completo", async ({ page }) => {
  const [leads, vehicles] = await Promise.all([
    prisma.leadVenda.findMany({ where: { source: WANTED_LEAD_SOURCE, status: { notIn: ["fechado", "perdido"] } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
    prisma.vehicle.findMany({ where: { status: "disponivel", historical: false }, orderBy: [{ createdAt: "desc" }, { id: "asc" }] }),
  ]);
  const ignored = await prisma.adminAudit.findMany({ where: { action: MATCH_DISMISSED_ACTION, entityId: { in: leads.map(lead => lead.id) } } });
  const dismissed = new Set(ignored.flatMap(item => {
    const vehicleId = (item.changes as { vehicleId?: string } | null)?.vehicleId;
    return vehicleId ? [item.entityId + ":" + vehicleId] : [];
  }));
  const expected = leads.flatMap(lead => vehicles.flatMap(vehicle => {
    const id = lead.id + ":" + vehicle.id;
    return !dismissed.has(id) && wantedStockMatch(lead, vehicle) ? [id] : [];
  }));
  const ids: string[] = [];
  let pages = 1;
  for (let current = 1; current <= pages; current++) {
    const body = await (await page.request.get(`/api/admin/avisos?tipo=pedidos&page=${current}`)).json();
    pages = body.pages;
    ids.push(...body.items.map((item: { id: string }) => item.id));
  }
  expect(ids).toEqual(expected);
});
