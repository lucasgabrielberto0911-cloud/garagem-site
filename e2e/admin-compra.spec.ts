import { test as base, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID, randomInt } from "node:crypto";
import { fictionalPurchase } from "../src/lib/purchase-test-fixture";

const database = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/");
const local = process.env.E2E_TEST === "1" && ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) && ["/ci", "/garagem_e2e"].includes(database.pathname);
const prisma = new PrismaClient();
const test = base.extend<{ adminId: string }>({
  adminId: async ({ page, context, baseURL }, executar) => {
    if (!local) throw new Error("Compra E2E aceita apenas banco local dedicado.");
    const email = `compra-${randomUUID()}@local.test`, password = "compra-ficticia-local-123";
    const admin = await prisma.admin.create({ data: { name: "Operador fictício de compra", email, passwordHash: await bcrypt.hash(password, 4) } });
    try {
      await page.route(/\/fotos\/|\/api\/fotos\/|supabase\.co\/storage\//, route => route.abort());
      await page.route("https://api.tabelafipe.info/**", () => { throw new Error("O navegador não pode consultar o provedor diretamente."); });
      await page.addInitScript(() => localStorage.setItem("garagem_consent", "essential"));
      await page.setExtraHTTPHeaders({ "X-Forwarded-For": `198.18.${randomInt(256)}.${randomInt(1, 255)}` });
      const login = await page.request.post("/api/auth/login", { data: { email, password } }); expect(login.ok()).toBeTruthy();
      const cookie = login.headers()["set-cookie"].split(";")[0];
      await context.addCookies([{ name: "session", value: cookie.slice("session=".length), url: baseURL!, httpOnly: true, sameSite: "Lax", secure: false }]);
      await executar(admin.id);
    } finally {
      // Somente neste Postgres descartável: o trigger impede apagar snapshots também via Prisma.
      await prisma.$transaction(async tx => {
        await tx.$executeRawUnsafe('ALTER TABLE "PurchaseEvaluationRevision" DISABLE TRIGGER purchase_revision_immutable');
        await tx.purchaseEvaluationRevision.deleteMany({ where: { createdById: admin.id } });
        await tx.$executeRawUnsafe('ALTER TABLE "PurchaseEvaluationRevision" ENABLE TRIGGER purchase_revision_immutable');
        await tx.purchaseEvaluation.deleteMany({ where: { adminId: admin.id } });
        await tx.adminAudit.deleteMany({ where: { adminId: admin.id } });
        await tx.admin.delete({ where: { id: admin.id } });
      });
    }
  },
});
test.skip(!local, "Requer banco local dedicado.");
test.afterAll(async () => prisma.$disconnect());

test("jornada autenticada: rascunho, cálculo no servidor, reabertura e revisão sem publicar veículos", async ({ page, adminId, baseURL }) => {
  const before = await Promise.all([prisma.vehicle.count(), prisma.sale.count(), prisma.vehicleCost.count()]);
  const title = `Compra fictícia ${randomUUID().slice(0, 8)}`;
  await page.goto("/admin/compra");
  await expect(page.getByRole("heading", { name: "Avaliador de compra" })).toBeVisible();
  await page.getByLabel("Descrição do veículo *", { exact: true }).fill(title);
  await page.getByLabel("Placa (opcional e privada)").fill("ABC1D23");
  await page.getByRole("button", { name: "2. Preço e custos", exact: true }).click();
  await page.getByLabel("Preço pedido pelo proprietário (R$) *", { exact: true }).fill("60000");
  await page.getByRole("button", { name: "Salvar avaliação", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Avaliação salva. Revisão 1.");
  await expect(page.getByRole("heading", { name: "Avaliação pendente", exact: true })).toBeVisible();
  const evaluation = await prisma.purchaseEvaluation.findFirstOrThrow({ where: { adminId, title } });
  const input = { ...fictionalPurchase(), title, plate: "ABC1D23" };
  const response = await page.request.post(`/api/admin/compra/${evaluation.id}/revisoes`, { headers: { Origin: baseURL! }, data: { input, requestKey: randomUUID(), expectedVersion: 1, output: { ceilingCents: 999999999 }, score: 100 } });
  expect(response.ok()).toBeTruthy(); expect(response.headers()["cache-control"]).toBe("private, no-store");
  const revision = await prisma.purchaseEvaluationRevision.findUniqueOrThrow({ where: { evaluationId_number: { evaluationId: evaluation.id, number: 2 } } });
  expect((revision.output as { ceilingCents: number }).ceilingCents).toBe(5862135);
  await page.reload();
  await page.getByRole("button", { name: `${title} · revisão 2`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "Não atende à política", exact: true })).toBeVisible();
  await expect(page.getByText("Há contribuição positiva, mas a meta não é atingida em todos os cenários. Isso não significa prejuízo.", { exact: true })).toBeVisible();
  await expect(page.getByText("R$ 58.621,35", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "2. Preço e custos", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Negociação", exact: true })).toHaveValue("fixo");
  await page.getByLabel("Preço pedido pelo proprietário (R$) *", { exact: true }).fill("55000");
  await page.getByRole("button", { name: "Salvar nova revisão", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Avaliação salva. Revisão 3.");
  await expect(page.getByRole("heading", { name: "Compensa sob estas condições", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revisão 2", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Não atende à política", exact: true })).toBeVisible();
  await expect(prisma.purchaseEvaluationRevision.update({ where: { id: revision.id }, data: { verdict: "compensa" } })).rejects.toThrow();
  expect(await Promise.all([prisma.vehicle.count(), prisma.sale.count(), prisma.vehicleCost.count()])).toEqual(before);
  expect(await prisma.adminAudit.count({ where: { adminId, action: "compra.revisao" } })).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath("avaliador-compra.png"), fullPage: true });
});

test("contrato privado: ownership, idempotência, 409, origem, payload e FIPE desligada", async ({ page, adminId, baseURL, playwright }) => {
  const foreign = await prisma.admin.create({ data: { name: "Outro operador fictício", email: `${randomUUID()}@local.test`, passwordHash: "hash-ficticio-inutilizavel" } });
  const privateEvaluation = await prisma.purchaseEvaluation.create({ data: { adminId: foreign.id, title: "Avaliação privada de outro operador" } });
  const lead = await prisma.leadVenda.create({ data: { name: "Pessoa fictícia", phone: "00000000000", vehicleInfo: "Usado fictício do E2E", plate: "XYZ9A87", km: 12345 } });
  const input = fictionalPurchase(), requestKey = randomUUID();
  const data = { input, requestKey, expectedVersion: 0 };
  const headers = { Origin: baseURL! };
  try {
    const sources = await (await page.request.post("/api/admin/compra/origem", { headers, data: { action: "search", plate: "XYZ9A87" } })).json();
    expect(sources).toEqual([{ kind: "lead", id: lead.id, title: "Usado fictício do E2E" }]);
    const sourceInput = await (await page.request.post("/api/admin/compra/origem", { headers, data: { action: "load", kind: "lead", id: lead.id } })).json();
    expect(sourceInput.km).toBe(12345); expect(sourceInput.source).toEqual({ kind: "lead", id: lead.id });
    expect(JSON.stringify(sourceInput)).not.toContain("00000000000"); expect(JSON.stringify(sourceInput)).not.toContain("Pessoa fictícia");
    const anonymous = await playwright.request.newContext({ baseURL });
    try { const response = await anonymous.get("/api/admin/compra"); expect(response.status()).toBe(401); expect(response.headers()["cache-control"]).toBe("private, no-store"); } finally { await anonymous.dispose(); }
    expect((await page.request.post("/api/admin/compra", { data, headers: { Origin: "https://externo.invalid" } })).status()).toBe(403);
    expect((await page.request.post("/api/admin/compra", { data })).status()).toBe(403);
    expect((await page.request.get(`/api/admin/compra/${privateEvaluation.id}`)).status()).toBe(404);
    expect((await page.request.post(`/api/admin/compra/${privateEvaluation.id}/revisoes`, { headers, data: {} })).status()).toBe(404);
    expect((await page.request.post(`/api/admin/compra/${privateEvaluation.id}/revisoes`, { headers, data })).status()).toBe(404);
    const created = await page.request.post("/api/admin/compra", { headers, data }); expect(created.ok()).toBeTruthy();
    const saved = await created.json();
    const again = await page.request.post("/api/admin/compra", { headers, data }); expect((await again.json()).id).toBe(saved.id);
    expect(await prisma.purchaseEvaluation.count({ where: { adminId, requestKey } })).toBe(1);
    expect((await page.request.post("/api/admin/compra", { headers, data: { ...data, input: { ...input, askedPriceCents: 1 } } })).status()).toBe(409);
    expect((await page.request.post(`/api/admin/compra/${saved.id}/revisoes`, { headers, data: { ...data, requestKey: randomUUID(), expectedVersion: 0 } })).status()).toBe(409);
    const next = { ...data, requestKey: randomUUID(), expectedVersion: 1 };
    const concurrent = await Promise.all([page.request.post(`/api/admin/compra/${saved.id}/revisoes`, { headers, data: next }), page.request.post(`/api/admin/compra/${saved.id}/revisoes`, { headers, data: { ...next, requestKey: randomUUID() } })]);
    expect(concurrent.map(r => r.status()).sort()).toEqual([200, 409]);
    const list = await (await page.request.get("/api/admin/compra")).json();
    expect(list.evaluations.some((e: { id: string }) => e.id === privateEvaluation.id)).toBe(false);
    expect(JSON.stringify(list)).not.toContain("ABC1D23");
    expect((await page.request.post("/api/admin/fipe-historico", { headers, data: { action: "match", brand: "Honda", model: "Fit EX", year: 2018 } })).status()).toBe(503);
    expect((await page.request.post("/api/admin/compra/simular", { headers, data: { input: { ...input, parameters: { ...input.parameters, proportionalRate: 1 } } } })).status()).toBe(422);
    expect((await page.request.post("/api/admin/compra", { headers, data: { ...data, padding: "x".repeat(65000) } })).status()).toBe(413);
  } finally {
    await prisma.leadVenda.delete({ where: { id: lead.id } });
    await prisma.purchaseEvaluation.delete({ where: { id: privateEvaluation.id } });
    await prisma.admin.delete({ where: { id: foreign.id } });
  }
});
