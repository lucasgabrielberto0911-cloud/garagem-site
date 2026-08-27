import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cardObjectPath, encodeCardImage } from "@/lib/image-variants";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  storagePathFromPublicUrl,
} from "@/lib/supabase";

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
    const path = storagePathFromPublicUrl(url);
    if (!path) {
      return NextResponse.json({ error: "URL de foto inválida." }, { status: 400 });
    }

    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Não foi possível baixar a foto para gerar a capa." },
        { status: 400 },
      );
    }

    const original = Buffer.from(await imageResponse.arrayBuffer());
    const card = await encodeCardImage(original);
    const cardPath = cardObjectPath(path);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .upload(cardPath, card.buffer, {
        contentType: card.contentType,
        upsert: true,
        cacheControl: "31536000",
      });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Falha ao salvar a miniatura." },
        { status: 500 },
      );
    }

    const { data } = supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .getPublicUrl(cardPath);

    return NextResponse.json({ url, thumbnailUrl: data.publicUrl });
  } catch (error) {
    console.error("[upload/variants]", error);
    return NextResponse.json(
      { error: "Não foi possível gerar a miniatura." },
      { status: 500 },
    );
  }
}
