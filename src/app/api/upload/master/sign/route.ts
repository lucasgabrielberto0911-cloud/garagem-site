import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createPhotoMasterId, masterObjectPathFromId } from "@/lib/photo-master";
import {
  VEHICLE_DOCS_BUCKET,
  ensurePrivateDocsBucket,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
} from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * URL assinada para o browser gravar o JPEG maior no bucket privado.
 * A resposta não inclui URL pública: só o admin baixa esse arquivo, pela sessão.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return NextResponse.json(
      {
        error:
          "Upload indisponível: configure NEXT_PUBLIC_SUPABASE_URL no Vercel.",
      },
      { status: 503 },
    );
  }

  if (!hasSupabaseServiceRole()) {
    return NextResponse.json(
      {
        error:
          "Upload indisponível: falta SUPABASE_SERVICE_ROLE_KEY no Vercel.",
      },
      { status: 503 },
    );
  }

  try {
    const id = createPhotoMasterId();
    const path = masterObjectPathFromId(id);
    if (!path) {
      return NextResponse.json(
        { error: "Não foi possível preparar o arquivo em alta." },
        { status: 500 },
      );
    }

    await ensurePrivateDocsBucket();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(VEHICLE_DOCS_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data?.token || !data.signedUrl) {
      console.error("Signed master upload URL error:", error);
      return NextResponse.json(
        { error: error?.message || "Não foi possível preparar o arquivo em alta." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id,
      path: data.path || path,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  } catch (error) {
    console.error("Master sign error:", error);
    return NextResponse.json(
      { error: "Erro ao preparar o arquivo em alta." },
      { status: 500 },
    );
  }
}
