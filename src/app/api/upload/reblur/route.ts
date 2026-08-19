import { NextResponse } from "next/server";
import sharp from "sharp";
import { getSession } from "@/lib/auth";
import {
  blurDetectedPlates,
  hasPlateBlurConfigured,
} from "@/lib/blur-plates";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  storagePathFromPublicUrl,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_EDGE = 1600;
const WEBP_QUALITY = 72;

/**
 * Reprocessa uma foto já enviada para borrar a placa (carros antigos
 * ou fotos que passaram no fallback sem Rekognition).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  if (!hasPlateBlurConfigured()) {
    return NextResponse.json(
      {
        error:
          "Blur de placa indisponível: configure AWS_ACCESS_KEY_ID e AWS_SECRET_ACCESS_KEY no Vercel.",
      },
      { status: 503 },
    );
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
    if (!storagePathFromPublicUrl(url)) {
      return NextResponse.json(
        { error: "URL de foto inválida." },
        { status: 400 },
      );
    }

    const imageResponse = await fetch(url);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Não foi possível baixar a foto para reprocessar." },
        { status: 400 },
      );
    }

    const original = Buffer.from(await imageResponse.arrayBuffer());
    const processed = await blurDetectedPlates(original);
    const blurred = processed !== original;

    if (!blurred) {
      return NextResponse.json({ url, blurred: false });
    }

    const optimized = await sharp(processed, { failOn: "none" })
      .rotate()
      .resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();

    const path = `${Date.now()}-${crypto.randomUUID()}.webp`;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .upload(path, optimized, {
        contentType: "image/webp",
        upsert: false,
        cacheControl: "31536000",
      });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Falha ao salvar a foto borracha." },
        { status: 500 },
      );
    }

    const { data } = supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl, blurred: true });
  } catch (error) {
    console.error("[upload/reblur]", error);
    return NextResponse.json(
      { error: "Não foi possível borrar a placa desta foto." },
      { status: 500 },
    );
  }
}
