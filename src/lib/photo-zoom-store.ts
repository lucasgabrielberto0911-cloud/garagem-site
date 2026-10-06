import { encodeZoomImage, ZOOM_MAX_BYTES } from "./photo-zoom-image";
import { zoomObjectPath } from "./photo-zoom-path";
import { masterObjectPathFromGalleryPath } from "./photo-master";
import { downloadPrivateMaster } from "./photo-master-store";
import { getSupabaseAdmin, VEHICLE_PHOTOS_BUCKET } from "./supabase";

const pending = new Map<string, Promise<Buffer | null>>();

async function load(galleryPath: string) {
  const path = zoomObjectPath(galleryPath);
  if (!path) return null;
  const storage = getSupabaseAdmin().storage.from(VEHICLE_PHOTOS_BUCKET);
  const cached = await storage.download(path);
  if (!cached.error && cached.data) {
    const bytes = Buffer.from(await cached.data.arrayBuffer());
    return bytes.length > 0 && bytes.length <= ZOOM_MAX_BYTES ? bytes : null;
  }
  const masterPath = masterObjectPathFromGalleryPath(galleryPath);
  const master = masterPath ? await downloadPrivateMaster(masterPath) : null;
  if (!master) return null;
  const bytes = await encodeZoomImage(master);
  if (!bytes) return null;
  // IDs são imutáveis: blur/rotação/restauração geram nova galeria e novo zoom.
  const upload = await storage.upload(path, bytes, { contentType: "image/webp", upsert: false, cacheControl: "31536000" });
  if (upload.error && !/already exists|duplicate|exists/i.test(upload.error.message)) {
    // A cópia ainda pode ser exibida; nenhuma alteração do anúncio foi feita.
    console.warn("[photo-zoom] cache indisponível");
  }
  return bytes;
}

export async function loadPhotoZoom(galleryPath: string) {
  const existing = pending.get(galleryPath);
  if (existing) return existing;
  if (pending.size >= 4) return null;
  const task = load(galleryPath).finally(() => pending.delete(galleryPath));
  pending.set(galleryPath, task);
  return task;
}
