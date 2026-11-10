import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkSharedLimit } from "@/lib/admin-login-limit";
import { isFipeHistoryEnabled } from "./purchase-flags";
import { PurchaseError } from "./purchase-input";
import { FIPE_HISTORY_BASE, FIPE_HISTORY_PROVIDER, parseFipeCandidates, parseFipeSnapshot, parseReferenceMonth, normalizeFuel, validateFipeIdentity, type FipeIdentity } from "./fipe-history";

const json = (value: unknown) => value as Prisma.InputJsonValue;
const keyFor = (path: string) => createHash("sha256").update(path).digest("hex");

/** Cache/lease no Postgres protege também funções em instâncias diferentes. */
async function providerRequest(path: string, ttl = 86400000, cacheReference = ""): Promise<{ data: unknown; stale: boolean; fetchedAt: string }> {
  if (!isFipeHistoryEnabled()) throw new PurchaseError("Histórico FIPE desativado; use referência manual com origem e mês.", 503);
  const key = keyFor(path + cacheReference), now = new Date();
  const cached = await prisma.fipeHistoryCache.findUnique({ where: { key } });
  if (cached && cached.expiresAt > now) {
    if (cached.status === 200 && cached.payload) return { data: cached.payload, stale: false, fetchedAt: cached.updatedAt.toISOString() };
    throw new PurchaseError("Consulta FIPE temporariamente indisponível. Aguarde ou use FIPE manual.", cached.status === 429 ? 429 : 503, Math.max(1, Math.ceil((cached.expiresAt.getTime() - Date.now()) / 1000)));
  }
  const fallback = () => cached?.payload && cached.status === 200 ? { data: cached.payload, stale: true, fetchedAt: cached.updatedAt.toISOString() } : null;
  const cooldown = await prisma.fipeHistoryCache.findUnique({ where: { key: "cooldown" } });
  if (cooldown && cooldown.expiresAt > now) {
    const snapshot = fallback(); if (snapshot) return snapshot;
    throw new PurchaseError("Limite do provedor FIPE. Respeite o prazo antes de tentar novamente.", 429, Math.ceil((cooldown.expiresAt.getTime() - now.getTime()) / 1000));
  }
  const lease = await prisma.$queryRaw<Array<{ key: string }>>`
    INSERT INTO "FipeHistoryCache" ("key", "status", "expiresAt", "updatedAt") VALUES (${`lease:${key}`}, 102, NOW() + INTERVAL '10 seconds', NOW())
    ON CONFLICT ("key") DO UPDATE SET "expiresAt" = NOW() + INTERVAL '10 seconds', "updatedAt" = NOW()
    WHERE "FipeHistoryCache"."expiresAt" <= NOW() RETURNING "key"`;
  if (!lease.length) { const snapshot = fallback(); if (snapshot) return snapshot; throw new PurchaseError("Já existe uma consulta igual em andamento. Tente novamente em instantes.", 503, 2); }
  try {
    const signal = AbortSignal.timeout(8000);
    for (let attempt = 0; attempt < 2; attempt++) {
      const limit = await checkSharedLimit("purchase:fipe:provider:global", { max: 30, windowMs: 60000 });
      if (!limit.ok) throw new PurchaseError("Orçamento de consultas FIPE atingido.", 429, limit.retryAfterSec);
      const response = await fetch(`${FIPE_HISTORY_BASE}${path}`, { signal, cache: "no-store", redirect: "error", headers: { Accept: "application/json" } });
      if (response.status === 429) {
        const raw = response.headers.get("Retry-After") ?? "60";
        const seconds = /^\d+$/.test(raw) ? Number(raw) : Math.ceil((Date.parse(raw) - Date.now()) / 1000);
        const expiresAt = new Date(Date.now() + (Number.isFinite(seconds) ? Math.max(1, Math.min(seconds, 2147483)) : 60) * 1000);
        await prisma.fipeHistoryCache.upsert({ where: { key: "cooldown" }, create: { key: "cooldown", status: 429, expiresAt }, update: { status: 429, expiresAt } });
        throw new PurchaseError("Limite do provedor FIPE; nova tentativa somente após o prazo informado.", 429, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
      }
      if (response.status >= 500 && attempt === 0) { await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150)); continue; }
      if (!response.ok) throw new PurchaseError("Provedor FIPE indisponível para esta consulta.", 503);
      const raw = await response.text();
      if (raw.length > 250000) throw new PurchaseError("Resposta FIPE muito grande.", 503);
      const data: unknown = JSON.parse(raw);
      // Só persiste respostas que respeitam o contrato do endpoint.
      if (path === "/referencia") parseReferenceMonth((data as { periodo?: unknown })?.periodo);
      else if (path.startsWith("/match?")) parseFipeCandidates(data);
      else if (!data || typeof data !== "object" || !("atual" in data)) throw new PurchaseError("Ficha FIPE inválida.", 503);
      await prisma.fipeHistoryCache.upsert({ where: { key }, create: { key, status: 200, payload: json(data), expiresAt: new Date(Date.now() + ttl) }, update: { status: 200, payload: json(data), expiresAt: new Date(Date.now() + ttl) } });
      return { data, stale: false, fetchedAt: new Date().toISOString() };
    }
    throw new PurchaseError("Provedor FIPE indisponível.", 503);
  } catch (error) {
    const snapshot = fallback();
    if (snapshot) return snapshot;
    const status = error instanceof PurchaseError ? error.status : 503;
    await prisma.fipeHistoryCache.upsert({ where: { key }, create: { key, status, expiresAt: new Date(Date.now() + 60000) }, update: { status, expiresAt: new Date(Date.now() + 60000) } });
    throw error instanceof PurchaseError ? error : new PurchaseError("Consulta FIPE falhou ou excedeu 8 segundos. Use FIPE manual.", 503);
  } finally {
    await prisma.fipeHistoryCache.deleteMany({ where: { key: `lease:${key}` } });
  }
}

export async function findFipeCandidates(brand: string, model: string, year: number) {
  if (!brand.trim() || brand.length > 80 || !model.trim() || model.length > 160 || !Number.isInteger(year) || year < 1950 || year > new Date().getUTCFullYear() + 1) throw new PurchaseError("Informe marca, versão e ano-modelo válidos.");
  const query = new URLSearchParams({ tipo: "carros", marca: brand, modelo: model, ano: String(year), limite: "5" });
  const result = await providerRequest(`/match?${query}`);
  return { candidates: parseFipeCandidates(result.data), stale: result.stale, fetchedAt: result.fetchedAt, warning: "Sugestões sem seleção automática. Confirme versão, ano e câmbio; scores empatados não resolvem identidade." };
}

export async function getFipeHistory(identity: FipeIdentity) {
  validateFipeIdentity(identity);
  const reference = await providerRequest("/referencia");
  const currentMonth = parseReferenceMonth((reference.data as { periodo: unknown }).periodo);
  const result = await providerRequest(`/fipe/${identity.code}?ano=${identity.modelYear}`, 86400000, currentMonth);
  const snapshot = parseFipeSnapshot(result.data, identity, result.fetchedAt);
  if (result.stale || reference.stale || snapshot.referenceMonth !== currentMonth) snapshot.warnings.push("Snapshot anterior: consulta atual indisponível ou referência desatualizada. Confira a data de coleta.");
  // A chave canônica preserva o combustível esperado e a decisão fica no snapshot privado.
  const fuel = normalizeFuel(identity.expectedFuel);
  await prisma.$transaction(snapshot.history.map(point => prisma.fipeMonthlyPrice.upsert({
    where: { provider_code_modelYear_fuel_referenceMonth: { provider: FIPE_HISTORY_PROVIDER, code: identity.code, modelYear: identity.modelYear, fuel, referenceMonth: point.referenceMonth } },
    create: { id: randomUUID(), provider: FIPE_HISTORY_PROVIDER, code: identity.code, modelYear: identity.modelYear, fuel, ...point, brandRaw: snapshot.brand, modelRaw: snapshot.model, fuelRaw: snapshot.fuelRaw, sourceUrl: snapshot.sourceUrl, parserVersion: snapshot.parserVersion, fetchedAt: new Date(snapshot.fetchedAt) },
    update: { valueCents: point.valueCents, brandRaw: snapshot.brand, modelRaw: snapshot.model, fuelRaw: snapshot.fuelRaw, sourceUrl: snapshot.sourceUrl, parserVersion: snapshot.parserVersion, fetchedAt: new Date(snapshot.fetchedAt) },
  })));
  return snapshot;
}
