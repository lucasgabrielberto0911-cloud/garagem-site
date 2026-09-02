import { cardObjectPath, encodeCardImage } from "@/lib/image-variants";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  storagePathFromPublicUrl,
} from "@/lib/supabase";

export type StoreCardThumbnailResult =
  | { ok: true; thumbnailUrl: string }
  | { ok: false; error: string };

/**
 * Gera o WebP 480×300 e grava no Storage ao lado da foto original.
 */
export async function storeCardThumbnail(
  publicUrl: string,
): Promise<StoreCardThumbnailResult> {
  if (!hasSupabaseServiceRole()) {
    return { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY." };
  }

  const path = storagePathFromPublicUrl(publicUrl);
  if (!path) {
    return { ok: false, error: "URL de foto inválida." };
  }

  const imageResponse = await fetch(publicUrl);
  if (!imageResponse.ok) {
    return { ok: false, error: `Download ${imageResponse.status}.` };
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
    return { ok: false, error: error.message || "Falha ao salvar a miniatura." };
  }

  const { data } = supabase.storage
    .from(VEHICLE_PHOTOS_BUCKET)
    .getPublicUrl(cardPath);

  return { ok: true, thumbnailUrl: data.publicUrl };
}
