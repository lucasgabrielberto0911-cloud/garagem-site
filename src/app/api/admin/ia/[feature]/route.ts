import { getSession } from "@/lib/auth";
import { hasTrustedMutationOrigin } from "@/lib/admin-request-origin";
import { checkSharedLimit } from "@/lib/admin-login-limit";
import { AdminAiInputError, runAdminAi } from "@/lib/admin-ai/service";

export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });

export async function POST(request: Request, context: { params: Promise<{ feature: string }> }) {
  try {
    const session = await getSession();
    if (!session) return json({ error: "Entre novamente no painel." }, 401);
    if (!hasTrustedMutationOrigin(request)) return json({ error: "Origem da solicitação inválida." }, 403);
    const { feature } = await context.params;
    if (!["revisar-texto", "melhorar-legenda", "ajuda-painel"].includes(feature)) return json({ error: "Recurso desconhecido." }, 404);
    const limit = await checkSharedLimit(`admin-ai:${session.adminId}`, { max: 12, windowMs: 60_000 });
    if (!limit.ok) return Response.json({ error: "Muitas solicitações. Aguarde um minuto." }, { status: 429, headers: { ...headers, "Retry-After": String(limit.retryAfterSec) } });
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "Envie JSON." }, 400);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Corpo ausente." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24_000) { await reader.cancel(); return json({ error: "Texto acima do limite." }, 413); }
      chunks.push(value);
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return json({ error: "JSON inválido." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Corpo inválido." }, 400);
    return json(await runAdminAi(feature, body));
  } catch (error) {
    return json({ error: error instanceof AdminAiInputError ? error.message : "IA indisponível no momento. Você pode continuar editando e salvar normalmente." }, error instanceof AdminAiInputError ? 422 : 503);
  }
}
