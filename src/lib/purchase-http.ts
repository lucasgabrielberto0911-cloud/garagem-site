import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasTrustedMutationOrigin } from "@/lib/admin-request-origin";
import { checkSharedLimit } from "@/lib/admin-login-limit";
import { isPurchaseEvaluatorEnabled } from "./purchase-flags";
import { PurchaseError } from "./purchase-input";
import { assertPurchaseSchema } from "./purchase-store";

export const PURCHASE_PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
export const purchaseJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: PURCHASE_PRIVATE_HEADERS });
export async function withPurchaseAccess(request: Request, action: (adminId: string) => Promise<unknown>) {
  try {
    const session = await getSession();
    if (!session) throw new PurchaseError("Entre novamente para avaliar compras.", 401);
    if (request.method !== "GET" && !hasTrustedMutationOrigin(request)) throw new PurchaseError("Origem da solicitação inválida.", 403);
    if (!isPurchaseEvaluatorEnabled()) throw new PurchaseError("Avaliador de compra desativado. A ativação depende da preparação do módulo.", 503);
    await assertPurchaseSchema();
    const limit = await checkSharedLimit(`purchase:admin:${session.adminId}`, { max: 60, windowMs: 60000 });
    if (!limit.ok) throw new PurchaseError("Muitas solicitações. Aguarde um minuto.", 429, limit.retryAfterSec);
    return purchaseJson(await action(session.adminId));
  } catch (error) {
    const known = error instanceof PurchaseError;
    return NextResponse.json({ error: known ? error.message : "Avaliador temporariamente indisponível. Nenhum dado do estoque foi alterado." }, { status: known ? error.status : 503, headers: { ...PURCHASE_PRIVATE_HEADERS, ...(known && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) } });
  }
}
export async function purchaseBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new PurchaseError("Envie JSON.", 400);
  if (Number(request.headers.get("content-length")) > 64000) throw new PurchaseError("Avaliação grande demais.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PurchaseError("Corpo ausente.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 64000) { await reader.cancel(); throw new PurchaseError("Avaliação grande demais.", 413); } chunks.push(value); }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new PurchaseError("JSON inválido.", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new PurchaseError("Corpo inválido.", 400);
  return body;
}
export function saveBody(body: Record<string, unknown>) {
  if (typeof body.requestKey !== "string" || typeof body.expectedVersion !== "number") throw new PurchaseError("Chave e versão obrigatórias.");
  return { input: body.input, requestKey: body.requestKey, expectedVersion: body.expectedVersion };
}
