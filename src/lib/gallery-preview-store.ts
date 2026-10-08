import { encodeGalleryPreview } from "./image-variants";
import { galleryPreviewObjectPath, readyGalleryPath } from "./gallery-preview-path";
import { getSupabaseAdmin, VEHICLE_PHOTOS_BUCKET } from "./supabase";

/** Prepara o preview antes de publicar a URL; falha mantém o caminho legado. */
export async function prepareGalleryUploadPath(id: string, gallery: { buffer: Buffer; extension: string }) {
  const path = readyGalleryPath(id, gallery.extension);
  try {
    const preview = await encodeGalleryPreview(gallery.buffer);
    const { error } = await getSupabaseAdmin().storage.from(VEHICLE_PHOTOS_BUCKET)
      .upload(galleryPreviewObjectPath(path)!, preview.buffer, {
        contentType: preview.contentType, cacheControl: "31536000", upsert: false,
      });
    if (!error || /already exists|duplicate/i.test(error.message)) return path;
  } catch { /* O upload da foto continua funcionando sem a otimização. */ }
  return `${id}.${gallery.extension}`;
}
