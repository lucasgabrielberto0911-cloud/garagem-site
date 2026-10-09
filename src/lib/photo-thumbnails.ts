import { prepareGalleryUploadPath } from "./gallery-preview-store";
import { galleryPreviewObjectPath } from "./gallery-preview-path";
import { cardObjectPath, encodeCardImage } from "@/lib/image-variants";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  hasSupabaseServiceRole,
  storagePathFromPublicUrl,
} from "@/lib/supabase";

export type StoreCardThumbnailResult =
  | { ok: true; thumbnailUrl: string | null; url?: string }
  | { ok: false; error: string };

/**
 * Gera o WebP 480×360 e grava no Storage ao lado da foto original.
 */
export async function storeCardThumbnail(
  publicUrl: string,
  options?: { prepareGallery: boolean },
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
  const supabase = getSupabaseAdmin();
  let galleryPath = path;
  let galleryUrl = publicUrl;
  // Só o fallback assinado pede a cópia: backfill/admin mantêm URLs cadastradas.
  if (options?.prepareGallery && !galleryPreviewObjectPath(path) && /^[0-9a-z-]{8,80}\.(webp|jpe?g)$/i.test(path)) {
    const extension = path.split(".").at(-1)!;
    const candidate = await prepareGalleryUploadPath(path.slice(0, -(extension.length + 1)), { buffer: original, extension });
    if (galleryPreviewObjectPath(candidate)) {
      const contentType = extension === "webp" ? "image/webp" : "image/jpeg";
      const { error } = await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).upload(candidate, original, {
        contentType, cacheControl: "31536000", upsert: false,
      });
      if (!error || /already exists|duplicate/i.test(error.message)) {
        galleryPath = candidate;
        galleryUrl = supabase.storage.from(VEHICLE_PHOTOS_BUCKET).getPublicUrl(candidate).data.publicUrl;
      } else {
        await supabase.storage.from(VEHICLE_PHOTOS_BUCKET).remove([galleryPreviewObjectPath(candidate)!]);
      }
    }
  }
  const cardPath = cardObjectPath(galleryPath);

  const { error } = await supabase.storage
    .from(VEHICLE_PHOTOS_BUCKET)
    .upload(cardPath, card.buffer, {
      contentType: card.contentType,
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) {
    // A galeria pronta ainda é válida quando somente a capa falha.
    if (galleryUrl !== publicUrl) return { ok: true, url: galleryUrl, thumbnailUrl: null };
    return { ok: false, error: error.message || "Falha ao salvar a miniatura." };
  }

  const { data } = supabase.storage
    .from(VEHICLE_PHOTOS_BUCKET)
    .getPublicUrl(cardPath);

  return { ok: true, thumbnailUrl: data.publicUrl, url: galleryUrl };
}
