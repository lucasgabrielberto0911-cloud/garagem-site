import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasTrustedMutationOrigin } from "@/lib/admin-request-origin";
import { hasSupabaseServiceRole } from "@/lib/supabase";
import { publishStagedPhoto } from "@/lib/upload-staging";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Segunda etapa do fallback pós-413 com R2: lê a foto temporária privada,
 * gera galeria e capa e publica só no R2.
 */
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasSupabaseServiceRole()) {
    return NextResponse.json({ error: "Upload indisponível: falta SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { path?: unknown };
  const result = await publishStagedPhoto(body.path);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url, thumbnailUrl: result.thumbnailUrl });
}
