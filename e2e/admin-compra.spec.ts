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

test("jornada curta: placa mockada, versão explícita, compra, resultado e revisão sem publicar", async ({ page, adminId, baseURL }) => {
  const before = await Promise.all([prisma.vehicle.count(), prisma.sale.count(), prisma.vehicleCost.count()]);
  const referenceMonth = new Date().toISOString().slice(0, 7);
  const candidates = [
    { code: "990001-0", brand: "Honda", model: "Fit EX fictício", modelYear: 2018, fuel: "Flex", valueCents: 7000000, score: 0.9 },
    { code: "990002-0", brand: "Honda", model: "Fit EXL fictício", modelYear: 2018, fuel: "Flex", valueCents: 7500000, score: 0.9 },
  ];
  const priceIds: string[] = [];
  for (const c of candidates) {
    const id = randomUUID(); priceIds.push(id);
    await prisma.fipeMonthlyPrice.create({ data: { id, provider: "tabelafipe.info", code: c.code, modelYear: c.modelYear, fuel: "flex", referenceMonth, valueCents: c.valueCents, brandRaw: c.brand, modelRaw: c.model, fuelRaw: c.fuel, sourceUrl: "https://tabelafipe.info", parserVersion: "fixture-e2e" } });
  }
  try {
    const internalOrder: string[] = [];
    page.on("request", request => { if (/\/compra\/(origem|placa)$/.test(request.url())) internalOrder.push(new URL(request.url()).pathname.split("/").at(-1)!); });
    await page.route("**/api/admin/compra/placa", route => route.fulfill({ json: { identity: { brand: "Honda", model: "Fit", version: "", modelYear: 2018, fuel: "Flex", transmission: "", confirmed: false }, candidates, warning: "Escolha a versão para confirmar a identidade." } }));
    await page.route("**/api/admin/fipe-historico", async route => {
      const request = route.request().postDataJSON();
      const c = candidates.find(candidate => candidate.code === request.code)!;
      await route.fulfill({ json: { provider: "tabelafipe.info", code: c.code, modelYear: 2018, fuelRaw: "Flex", fuelNormalized: "flex", brand: c.brand, model: c.model, referenceMonth, valueCents: c.valueCents, fetchedAt: new Date().toISOString(), sourceUrl: "https://tabelafipe.info", parserVersion: "fixture-e2e", warnings: [], history: [{ referenceMonth, valueCents: c.valueCents }] } });
    });
    await page.goto("/admin/compra");
    await expect(page.getByRole("heading", { name: "Avaliador de compra" })).toBeVisible();
    await page.getByLabel("Placa", { exact: true }).fill("ABC1D23");
    await page.getByLabel("Placa", { exact: true }).press("Enter");
    const selector = page.getByRole("combobox", { name: "Confirme a versão FIPE" });
    await expect(selector).toBeVisible(); await expect(selector).toHaveValue("");
    await expect(page.getByRole("button", { name: "Continuar para compra" })).toBeDisabled();
    await selector.selectOption("990002-0");
    await expect(page.getByText(/FIPE da versão escolhida/)).toContainText("75.000,00");
    expect(internalOrder.slice(0, 2)).toEqual(["origem", "placa"]);
    await page.getByRole("button", { name: "Continuar para compra" }).click();
    await expect(page.getByText(/FIPE da versão escolhida/)).toBeVisible();
    await page.getByLabel("Preço de compra (R$) *", { exact: true }).fill("55000");
    await page.getByRole("button", { name: "Sem oferta (avaliar neste valor)", exact: true }).click();
    await page.getByLabel("O que o carro tem ou precisa fazer? (opcional)").fill("Tem manual e chave reserva; precisa revisar o ar. Dados fictícios.");
    await expect(page.locator("textarea")).toHaveCount(1);
    await page.getByRole("button", { name: "Calcular parecer", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nota da compra neste valor" })).toBeVisible();
    await expect(page.getByText(/Parecer de IA indisponível/).first()).toBeVisible();
    await expect(page.getByText("Preço ideal de compra (referência)", { exact: true })).toBeVisible();
    await expect(page.getByText("Lucro estimado", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Salvar avaliação", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Avaliação salva." })).toContainText("Avaliação salva. Revisão 1.");
    const evaluation = await prisma.purchaseEvaluation.findFirstOrThrow({ where: { adminId } });
    const revision = await prisma.purchaseEvaluationRevision.findUniqueOrThrow({ where: { evaluationId_number: { evaluationId: evaluation.id, number: 1 } } });
    const evidence = revision.evidenceSnapshot as { quick: { schemaVersion: number; dealType: string }; opinion: { available: boolean } };
    expect(evidence.quick.schemaVersion).toBe(2); expect(evidence.quick.dealType).toBe("sem_oferta"); expect(evidence.opinion.available).toBe(false);
    const replay = await page.request.post(`/api/admin/compra/${evaluation.id}/revisoes`, { headers: { Origin: baseURL! }, data: { input: evidence.quick, requestKey: revision.requestKey, expectedVersion: 0 } });
    expect(replay.ok()).toBeTruthy(); expect((await replay.json()).replayed).toBe(true);
    await page.reload();
    await page.getByText("Minhas avaliações", { exact: true }).click();
    await page.getByRole("button", { name: `${evaluation.title} · revisão 1`, exact: true }).click();
    await expect(page.getByRole("heading", { name: "Nota da compra neste valor" })).toBeVisible();
    await page.getByRole("button", { name: "Ajustar compra", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sem oferta (avaliar neste valor)", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Repasse", exact: true }).click();
    await page.getByLabel("Preço de compra (R$) *", { exact: true }).fill("80000");
    await page.getByRole("button", { name: "Calcular parecer", exact: true }).click();
    await expect(page.getByText("Prejuízo estimado", { exact: true })).toBeVisible();
    await expect(page.getByText(/Repasse: hipótese de giro curto/)).toBeVisible();
    await page.getByRole("button", { name: "Salvar nova revisão", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Avaliação salva." })).toContainText("Avaliação salva. Revisão 2.");
    await expect(prisma.purchaseEvaluationRevision.update({ where: { id: revision.id }, data: { verdict: "compensa" } })).rejects.toThrow();
    expect(await Promise.all([prisma.vehicle.count(), prisma.sale.count(), prisma.vehicleCost.count()])).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: test.info().outputPath("compra-curta.png"), fullPage: true });
  } finally { await prisma.fipeMonthlyPrice.deleteMany({ where: { id: { in: priceIds } } }); }
});

test("falha de placa permite mínimo manual e resultado sem FIPE inventada", async ({ page, adminId }) => {
  expect(adminId).toBeTruthy();
  await page.route("**/api/admin/compra/placa", route => route.fulfill({ status: 503, json: { error: "Consulta de placa indisponível. Preencha marca, modelo e ano." } }));
  await page.goto("/admin/compra");
  await page.getByLabel("Placa", { exact: true }).fill("ZZZ0A00");
  await page.getByLabel("Placa", { exact: true }).press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "indisponível" })).toContainText("indisponível");
  await page.getByLabel("Marca", { exact: true }).fill("Honda");
  await page.getByLabel("Modelo", { exact: true }).fill("Fit fictício");
  await page.getByLabel("Ano-modelo", { exact: true }).fill("2018");
  await page.getByRole("button", { name: "Continuar para compra" }).click();
  await page.getByLabel("Preço de compra (R$) *", { exact: true }).fill("50000");
  await page.getByRole("button", { name: "Calcular parecer" }).click();
  await expect(page.getByText("Sem nota financeira", { exact: true })).toBeVisible();
  await expect(page.getByText(/Informe uma referência FIPE/)).toBeVisible();
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
