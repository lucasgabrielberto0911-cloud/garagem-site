import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
} from "@/lib/supabase";

export const runtime = "nodejs";

/**
 * Emite URL assinada para o browser enviar a foto direto ao Storage,
 * evitando o limite de body (~4.5 MB) da Vercel que causa 413.
 */
export async function POST(request: Request) {
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
    const body = (await request.json()) as {
      contentType?: string;
      extension?: string;
    };

    const contentType =
      body.contentType === "image/jpeg" ? "image/jpeg" : "image/webp";
    const extension =
      body.extension === "jpg" || body.extension === "jpeg"
        ? "jpg"
        : contentType === "image/jpeg"
          ? "jpg"
          : "webp";

    const path = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("Signed upload URL error:", error);
      return NextResponse.json(
        { error: error?.message || "Não foi possível preparar o upload." },
        { status: 500 },
      );
    }

    const { data: publicData } = supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
      publicUrl: publicData.publicUrl,
      contentType,
    });
  } catch (error) {
    console.error("Upload sign error:", error);
    return NextResponse.json(
      { error: "Erro ao preparar upload." },
      { status: 500 },
    );
  }
}
