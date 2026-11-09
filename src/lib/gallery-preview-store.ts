import { encodeGalleryPreview } from "./image-variants";
import { galleryPreviewObjectPath, readyGalleryPath } from "./gallery-preview-path";
import { hasR2Config, uploadR2Photo } from "./r2-photos";
import { getSupabaseAdmin, VEHICLE_PHOTOS_BUCKET } from "./supabase";

/** Prepara o preview antes de publicar a URL; falha mantém o caminho legado. */
export async function prepareGalleryUploadPath(id: string, gallery: { buffer: Buffer; extension: string }) {
  const path = readyGalleryPath(id, gallery.extension);
  try {
    const preview = await encodeGalleryPreview(gallery.buffer);
    const previewPath = galleryPreviewObjectPath(path)!;
    if (hasR2Config()) {
      await uploadR2Photo(previewPath, preview.buffer, preview.contentType);
      return path;
    }
    const { error } = await getSupabaseAdmin().storage.from(VEHICLE_PHOTOS_BUCKET)
      .upload(previewPath, preview.buffer, {
        contentType: preview.contentType, cacheControl: "31536000", upsert: false,
      });
    if (!error || /already exists|duplicate/i.test(error.message)) return path;
  } catch { /* O upload da foto continua funcionando sem a otimização. */ }
  return `${id}.${gallery.extension}`;
}
