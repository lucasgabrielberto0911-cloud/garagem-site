import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  blurDetectedPlates,
  hasPlateBlurConfigured,
} from "@/lib/blur-plates";
import { cardObjectPath, encodeCardImage, encodeGalleryImage } from "@/lib/image-variants";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  storagePathFromPublicUrl,
} from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const [gallery, card] = await Promise.all([
      encodeGalleryImage(processed),
      encodeCardImage(processed),
    ]);
    const id = `${Date.now()}-${crypto.randomUUID()}`;
    const galleryPath = `${id}.${gallery.extension}`;
    const cardPath = cardObjectPath(galleryPath);
    const supabase = getSupabaseAdmin();

    const [galleryUpload, cardUpload] = await Promise.all([
      supabase.storage.from(VEHICLE_PHOTOS_BUCKET).upload(galleryPath, gallery.buffer, {
        contentType: gallery.contentType,
        upsert: false,
        cacheControl: "31536000",
      }),
      supabase.storage.from(VEHICLE_PHOTOS_BUCKET).upload(cardPath, card.buffer, {
        contentType: card.contentType,
        upsert: false,
        cacheControl: "31536000",
      }),
    ]);

    if (galleryUpload.error) {
      return NextResponse.json(
        { error: galleryUpload.error.message || "Falha ao salvar a foto borracha." },
        { status: 500 },
      );
    }

    const { data } = supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .getPublicUrl(galleryPath);
    const thumb = supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .getPublicUrl(cardPath);

    return NextResponse.json({
      url: data.publicUrl,
      thumbnailUrl: cardUpload.error ? null : thumb.data.publicUrl,
      blurred: true,
    });
  } catch (error) {
    console.error("[upload/reblur]", error);
    return NextResponse.json(
      { error: "Não foi possível borrar a placa desta foto." },
      { status: 500 },
    );
  }
}
