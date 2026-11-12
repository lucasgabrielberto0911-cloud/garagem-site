import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parsePurchaseInput, PurchaseError, type PurchaseInput } from "./purchase-input";
import { DEFAULT_PURCHASE_POLICY, parsePurchasePolicy } from "./purchase-policy";
import { simulatePurchase } from "./purchase-simulator";
import { scorePurchase } from "./purchase-score";
import { normalizeFuel, type FipeSnapshot } from "./fipe-history";
import { parseQuickPurchase, mapQuickPurchase, quickPolicy } from "./purchase-quick";
import { extractPurchaseCosts, writePurchaseOpinion, purchaseAiPayload, PURCHASE_AI_MODEL } from "./admin-ai/purchase-nvidia";
import { loadPurchaseSource } from "./purchase-source";

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function assertPurchaseSchema() {
  const rows = await prisma.$queryRaw<Array<{ ready: boolean }>>`SELECT bool_and(to_regclass(format('public.%I', t)) IS NOT NULL) AS ready FROM unnest(ARRAY['PurchaseEvaluation','PurchaseEvaluationRevision','FipeMonthlyPrice','VehicleFipeIdentity','VehicleAcquisitionMetadata','PurchasePolicyVersion','FipeHistoryCache']) AS t`;
  if (!rows[0]?.ready) throw new PurchaseError("Avaliador indisponível: a estrutura do módulo ainda não foi preparada.", 503);
}

async function fipeEvidence(input: PurchaseInput) {
  const f = input.fipe;
  if (!f) return null;
  if (f.provider === "manual") return { ...f, verified: false, warning: "FIPE manual não verificada; origem e referência declaradas pelo operador." };
  if (!input.identity.confirmed || !/^\d{6}-\d$/.test(f.code)) throw new PurchaseError("Confirme a identidade antes de usar a FIPE consultada.");
  const prices = await prisma.fipeMonthlyPrice.findMany({ where: { provider: f.provider, code: f.code, modelYear: input.identity.modelYear!, fuel: normalizeFuel(input.identity.fuel), referenceMonth: { lte: f.referenceMonth } }, orderBy: { referenceMonth: "desc" }, take: 24 });
  const current = prices.find(p => p.referenceMonth === f.referenceMonth);
  if (!current || current.valueCents !== f.valueCents || current.modelRaw !== input.identity.version || current.brandRaw?.toLowerCase() !== input.identity.brand.toLowerCase()) throw new PurchaseError("Snapshot FIPE não corresponde à versão, ano ou preço confirmado. Consulte novamente.");
  const warnings: string[] = [];
  if (normalizeFuel(current.fuelRaw ?? "") !== normalizeFuel(input.identity.fuel) || (/flex/i.test(current.modelRaw ?? "") && normalizeFuel(current.fuelRaw ?? "") !== "flex")) {
    if (!f.fuelDecision.trim()) throw new PurchaseError("Registre a decisão sobre combustível divergente.");
    warnings.push(`Combustível bruto: ${current.fuelRaw}. Decisão humana: ${f.fuelDecision}`);
  }
  if (Date.now() - current.fetchedAt.getTime() > 86400000 || current.referenceMonth !== new Date().toISOString().slice(0, 7)) warnings.push("Snapshot FIPE anterior: confira a referência e a coleta.");
  return { provider: f.provider, code: f.code, modelYear: current.modelYear, fuelRaw: current.fuelRaw ?? "", fuelNormalized: normalizeFuel(input.identity.fuel), brand: current.brandRaw ?? "", model: current.modelRaw ?? "", referenceMonth: current.referenceMonth, valueCents: current.valueCents, fetchedAt: current.fetchedAt.toISOString(), sourceUrl: current.sourceUrl ?? "https://tabelafipe.info", parserVersion: current.parserVersion, warnings, history: prices.map(p => ({ referenceMonth: p.referenceMonth, valueCents: p.valueCents })) } satisfies FipeSnapshot;
}

/** Cache privado compartilhado: reusa a tabela de cache já existente, sem migration. */
async function cachedPurchaseAi<T extends { available: boolean }>(phase: string, payload: unknown, run: () => Promise<T>): Promise<T> {
  if (!(process.env.ADMIN_AI_NVIDIA_API_KEY?.trim() || process.env.NVIDIA_API_KEY?.trim())) return run();
  const key = `compra-ia:${hash([PURCHASE_AI_MODEL, phase, payload])}`;
  try {
    const cached = await prisma.fipeHistoryCache.findUnique({ where: { key } });
    if (cached?.status === 200 && cached.payload && cached.expiresAt.getTime() > Date.now()) return cached.payload as unknown as T;
  } catch { /* Falha de cache não impede o cálculo. */ }
  const result = await run();
  if (result.available) {
    try {
      const expiresAt = new Date(Date.now() + 900_000), payload = json(result);
      await prisma.fipeHistoryCache.upsert({ where: { key }, create: { key, status: 200, payload, expiresAt }, update: { status: 200, payload, expiresAt } });
    } catch { /* O parecer continua utilizável sem cache compartilhado. */ }
  }
  return result;
}

export async function preparePurchase(raw: unknown) {
  const quick = (raw as { schemaVersion?: unknown })?.schemaVersion === 2 ? parseQuickPurchase(raw) : null;
  let input = quick ? mapQuickPurchase(quick, []) : parsePurchaseInput(raw);
  await assertPurchaseSchema();
  const published = await prisma.purchasePolicyVersion.findFirst({ where: { key: "padrao", publishedAt: { not: null } }, orderBy: { version: "desc" } });
  const policy = published ? parsePurchasePolicy(published.body) : DEFAULT_PURCHASE_POLICY;
  if (!policy) throw new PurchaseError("Política publicada inválida; solicite revisão ao responsável.", 503);
  const fipeSnapshot = await fipeEvidence(input);
  if (quick) input = mapQuickPurchase(quick, [], policy);
  if (input.source) await loadPurchaseSource(input.source);
  const extracted = quick ? await cachedPurchaseAi("custos-v1", { input: purchaseAiPayload(input, quick), parameters: input.parameters, profile: policy.defaultCostItems }, () => extractPurchaseCosts(input, quick)) : null;
  if (quick) input = mapQuickPurchase(quick, extracted!.items, policy);
  const output = simulatePurchase(input, quick ? quickPolicy(quick, policy) : policy), score = scorePurchase(input, output);
  const opinion = quick ? await cachedPurchaseAi("parecer-v1", { input: purchaseAiPayload(input, quick), output, costs: extracted!.items }, () => writePurchaseOpinion(input, quick, output, extracted!.available, extracted!)) : null;
  if (quick) {
    score.scoreVersion = "2.0.0-rapido";
    score.total = opinion!.grade === null ? null : Math.round(opinion!.grade * 10);
    score.min = score.total ?? 0; score.max = score.total ?? 100;
    score.partial = score.min; score.confidence = "baixa";
    score.verdict = opinion!.grade === null ? "pendente" : input.inspection === "reprovado" || opinion!.grade < 4 ? "nao_atende" : output.policyPassed ? "compensa" : "atencao";
  }
  return { input, fipeSnapshot, policySnapshot: { ...output.parameters, publication: published ? { id: published.id, version: published.version } : null }, evidenceSnapshot: { schemaVersion: 1, quick, opinion, resale: { id: "entrada:revenda", ...input.resaleEvidence }, liquidity: { id: "entrada:liquidez", ...input.liquidity }, conditions: { id: "entrada:condicoes", items: input.conditions }, costs: { id: "entrada:custos", items: input.costs }, inspection: { id: "entrada:laudo", status: input.inspection, verified: input.inspectionVerified, note: input.inspectionNote, restriction: input.restriction }, completeness: { id: "entrada:completude", manual: input.manual, spareKey: input.spareKey, maintenanceHistory: input.maintenanceHistory } }, output, score, opinion };
}
export type PreparedPurchase = Awaited<ReturnType<typeof preparePurchase>>;

export async function listPurchases(adminId: string, cursor?: string) {
  const rows = await prisma.purchaseEvaluation.findMany({ where: { adminId, ...(cursor ? { id: { lt: cursor } } : {}) }, orderBy: { id: "desc" }, take: 21, select: { id: true, title: true, currentVersion: true, updatedAt: true } });
  return { evaluations: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].id : null };
}
export async function readPurchase(adminId: string, id: string) {
  const evaluation = await prisma.purchaseEvaluation.findFirst({ where: { id, adminId }, select: { id: true, title: true, currentVersion: true, updatedAt: true, revisions: { orderBy: { number: "desc" }, take: 20, select: { id: true, number: true, createdAt: true, input: true, output: true, score: true, fipeSnapshot: true, evidenceSnapshot: true, policySnapshot: true, engineVersion: true, scoreVersion: true } } } });
  if (!evaluation) throw new PurchaseError("Avaliação não encontrada.", 404);
  return evaluation;
}

function replay(revision: { input: unknown; evidenceSnapshot?: unknown; number: number; evaluationId: string }, input: PurchaseInput, quick: unknown) {
  const storedQuick = (revision.evidenceSnapshot as { quick?: unknown })?.quick;
  if (quick ? !storedQuick || hash(parseQuickPurchase(storedQuick)) !== hash(quick) : hash(parsePurchaseInput(revision.input)) !== hash(input)) throw new PurchaseError("Esta chave já foi usada com outra entrada. Recarregue antes de salvar.", 409);
  return { id: revision.evaluationId, currentVersion: revision.number, replayed: true };
}

export async function savePurchase(adminId: string, body: { input: unknown; requestKey: string; expectedVersion: number }, id?: string) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(body.requestKey) || !Number.isInteger(body.expectedVersion) || body.expectedVersion < 0 || body.expectedVersion > 2147483646 || (!id && body.expectedVersion !== 0)) throw new PurchaseError("Chave de salvamento ou versão inválida.");
  if (id && !(await prisma.purchaseEvaluation.findFirst({ where: { id, adminId }, select: { id: true } }))) throw new PurchaseError("Avaliação não encontrada.", 404);
  const prepared = await preparePurchase(body.input), { input, output, score } = prepared;
  const revisionData = { createdById: adminId, requestKey: body.requestKey, askedPriceCents: input.askedPriceCents, priceMode: input.priceMode, input: json(input), fipeSnapshot: prepared.fipeSnapshot ? json(prepared.fipeSnapshot) : Prisma.JsonNull, policySnapshot: json(prepared.policySnapshot), evidenceSnapshot: json(prepared.evidenceSnapshot), output: json(output), score: json(score), scoreTotal: score.total, scoreMin: score.min, scoreMax: score.max, verdict: score.verdict, confidence: score.confidence, engineVersion: output.engineVersion, scoreVersion: score.scoreVersion };
  try {
    return await prisma.$transaction(async tx => {
      let evaluation;
      if (id) {
        evaluation = await tx.purchaseEvaluation.findFirst({ where: { id, adminId } });
        if (!evaluation) throw new PurchaseError("Avaliação não encontrada.", 404);
        const previous = await tx.purchaseEvaluationRevision.findUnique({ where: { evaluationId_requestKey: { evaluationId: id, requestKey: body.requestKey } } });
        if (previous) return replay(previous, input, prepared.evidenceSnapshot.quick);
        const updated = await tx.purchaseEvaluation.updateMany({ where: { id, adminId, currentVersion: body.expectedVersion }, data: { currentVersion: { increment: 1 }, title: input.title, plate: input.plate || null, vehicleId: input.source?.kind === "vehicle" ? input.source.id : null, leadId: input.source?.kind === "lead" ? input.source.id : null, status: score.verdict === "pendente" ? "rascunho" : "avaliada" } });
        if (!updated.count) throw new PurchaseError("Outra revisão foi salva. Reabra a avaliação antes de gravar novamente.", 409);
      } else {
        const previous = await tx.purchaseEvaluation.findUnique({ where: { adminId_requestKey: { adminId, requestKey: body.requestKey } }, include: { revisions: { where: { number: 1 } } } });
        if (previous) return replay(previous.revisions[0], input, prepared.evidenceSnapshot.quick);
        evaluation = await tx.purchaseEvaluation.create({ data: { adminId, requestKey: body.requestKey, title: input.title, plate: input.plate || null, vehicleId: input.source?.kind === "vehicle" ? input.source.id : null, leadId: input.source?.kind === "lead" ? input.source.id : null, currentVersion: 1, status: score.verdict === "pendente" ? "rascunho" : "avaliada" } });
      }
      const number = id ? body.expectedVersion + 1 : 1;
      await tx.purchaseEvaluationRevision.create({ data: { ...revisionData, evaluationId: evaluation.id, number } });
      await tx.adminAudit.create({ data: { adminId, entityId: evaluation.id, action: "compra.revisao", changes: { number, inputHash: hash(input), engineVersion: output.engineVersion, scoreVersion: score.scoreVersion } } });
      return { id: evaluation.id, currentVersion: number, replayed: false };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const evaluation = await prisma.purchaseEvaluation.findFirst({ where: id ? { id, adminId } : { adminId, requestKey: body.requestKey } });
      if (evaluation) {
        const previous = await prisma.purchaseEvaluationRevision.findUnique({ where: { evaluationId_requestKey: { evaluationId: evaluation.id, requestKey: body.requestKey } } });
        if (previous) return replay(previous, input, prepared.evidenceSnapshot.quick);
      }
      throw new PurchaseError("Conflito de salvamento. Reabra a avaliação.", 409);
    }
    throw error;
  }
}
