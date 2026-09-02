import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { storeCardThumbnail } from "@/lib/photo-thumbnails";
import { hasSupabaseServiceRole } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Gera a miniatura 480×300 a partir de uma foto já no Storage (fallback
 * do upload assinado, quando /api/upload estoura o limite da Vercel).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json(
      { error: "Upload indisponível: falta SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as { url?: string };
    const url = body.url?.trim() ?? "";
    const result = await storeCardThumbnail(url);
    if (!result.ok) {
      const status = result.error.includes("inválida") ? 400 : 500;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ url, thumbnailUrl: result.thumbnailUrl });
  } catch (error) {
    console.error("[upload/variants]", error);
    return NextResponse.json(
      { error: "Não foi possível gerar a miniatura." },
      { status: 500 },
    );
  }
}
