import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { coverFrameSourcePath, framedCardObjectPath, parseCoverFrame } from "@/lib/cover-frame";
import { encodeFramedCardImage } from "@/lib/image-variants";
import { ownPublicPhotoPath } from "@/lib/own-photo-path";
import { masterObjectPathFromGalleryPath } from "@/lib/photo-master";
import { downloadPrivateMaster } from "@/lib/photo-master-store";
import { getSupabaseAdmin, hasSupabaseServiceRole, VEHICLE_PHOTOS_BUCKET } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };
const MAX_GALLERY_BYTES = 20 * 1024 * 1024;

/**
 * Grava a miniatura 480×360 da capa na janela escolhida no admin. Parte do
 * original privado (até 3840 px) quando existe; senão, do arquivo da galeria.
 * Cada enquadramento tem nome próprio: a URL muda e o cache longo continua
 * valendo. A foto da galeria não é tocada; o anúncio só passa a usar a
 * miniatura nova quando o admin salva.
 */
export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401, headers });
  if (!hasSupabaseServiceRole()) return NextResponse.json({ error: "Fotos indisponíveis." }, { status: 503, headers });
  try {
    const body = await request.json();
    const galleryPath = coverFrameSourcePath(ownPublicPhotoPath(body?.url));
    const frame = parseCoverFrame(body?.frame);
    if (!galleryPath || !frame) {
      return NextResponse.json({ error: "Esta foto não pode ser reenquadrada." }, { status: 400, headers });
    }
    const supabase = getSupabaseAdmin();
    const masterPath = masterObjectPathFromGalleryPath(galleryPath);
    let source = masterPath ? await downloadPrivateMaster(masterPath) : null;
    if (!source) {
      const { data, error } = await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).download(galleryPath);
      if (error || !data || data.size > MAX_GALLERY_BYTES) throw new Error("source");
      source = new Uint8Array(await data.arrayBuffer());
    }
    const card = await encodeFramedCardImage(Buffer.from(source), frame);
    const cardPath = framedCardObjectPath(galleryPath, frame);
    const { error } = await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).upload(cardPath, card.buffer, {
      contentType: card.contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    // Mesmo foto e mesmo enquadramento geram os mesmos bytes: o arquivo existente serve.
    if (error && !/already exists|duplicate/i.test(error.message)) throw error;
    return NextResponse.json({ thumbnailUrl: supabase.storage.from(VEHICLE_PHOTOS_BUCKET).getPublicUrl(cardPath).data.publicUrl }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Pedido inválido." }, { status: 400, headers });
    console.error("[upload/cover-frame]", error);
    return NextResponse.json({ error: "Não foi possível salvar o enquadramento. A capa atual foi mantida." }, { status: 500, headers });
  }
}
