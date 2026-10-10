import type { SupabaseClient } from "@supabase/supabase-js";
import { framedCardObjectPath, hdCardCompanion, type CoverFrame } from "@/lib/cover-frame";
import type { FramedCardSet } from "@/lib/image-variants";
import { VEHICLE_PHOTOS_BUCKET } from "@/lib/storage-file-ref";

type UploadResult = { path: string; error: Error | null };

async function put(supabase: SupabaseClient, path: string, image: { buffer: Buffer; contentType: string }) {
  const { error } = await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).upload(path, image.buffer, {
    contentType: image.contentType,
    cacheControl: "31536000",
    upsert: false,
  });
  // Mesma foto e mesmo enquadramento geram os mesmos bytes: o arquivo existente serve.
  return error && !/already exists|duplicate/i.test(error.message) ? error : null;
}

/**
 * Grava a capa enquadrada ao lado da foto da galeria. O 960×720 vai primeiro:
 * só se ele existir o 480 recebe o nome `-hd` (a promessa de que o par existe).
 * Se o 960 falhar, a capa sai só com o 480 no nome antigo — nunca um `-hd` sem par.
 * Nunca lança; a falha do 480 volta em `error`.
 */
export async function uploadFramedCard(
  supabase: SupabaseClient,
  galleryPath: string,
  frame: CoverFrame,
  set: FramedCardSet,
): Promise<UploadResult> {
  let hd = false;
  if (set.hd) {
    const hdPath = hdCardCompanion(framedCardObjectPath(galleryPath, frame, true))!;
    const hdError = await put(supabase, hdPath, set.hd).catch((error: Error) => error);
    if (hdError) console.warn("[framed-card] 960×720 não gravado, segue só com o 480:", hdError.message);
    else hd = true;
  }
  const path = framedCardObjectPath(galleryPath, frame, hd);
  const error = await put(supabase, path, set.card).catch((caught: Error) => caught);
  return { path, error };
}
