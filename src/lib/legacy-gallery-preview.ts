import { PHOTO_STORAGE_ORIGIN, validPublicPhotoKey } from "./public-photo-url";
import { galleryPreviewObjectPath } from "./gallery-preview-path";
import { encodeGalleryPreview } from "./image-variants";

export function legacyGalleryPlan(url: string, storageOrigin = PHOTO_STORAGE_ORIGIN) {
  try {
    const source = new URL(url);
    const prefix = "/storage/v1/object/public/veiculos/";
    if (source.origin !== new URL(storageOrigin).origin || source.username || source.password || source.search || source.hash || !source.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(source.pathname.slice(prefix.length));
    if (!validPublicPhotoKey(path.split("/")) || galleryPreviewObjectPath(path)) return null;
    const match = path.match(/^(.*\/)?([a-z0-9-]{8,80})\.(webp|jpe?g|png)$/i);
    if (!match || /-(?:card|preview|zoom)$/.test(match[2])) return null;
    const galleryPath = `${match[1] ?? ""}${match[2]}-g800.${match[3]}`;
    const previewPath = galleryPreviewObjectPath(galleryPath)!;
    return {
      sourcePath: path, galleryPath, previewPath,
      galleryUrl: `${source.origin}${prefix}${galleryPath}`,
      contentType: match[3].toLowerCase() === "webp" ? "image/webp" : match[3].toLowerCase() === "png" ? "image/png" : "image/jpeg",
    };
  } catch { return null; }
}

export type LegacyGalleryPhoto = { id: string; vehicleId: string; url: string };
export type LegacyGalleryReceipt = LegacyGalleryPhoto & { nextUrl: string; previewBytes: number; originalBytes: number };
export type LegacyGalleryIO = {
  read: (path: string) => Promise<Buffer>;
  /** Must never overwrite an existing immutable object. */
  put: (path: string, bytes: Buffer, type: string) => Promise<void>;
  replace: (id: string, expectedUrl: string, nextUrl: string) => Promise<boolean>;
  /** Persist the recovery record before changing the database. */
  journal: (receipt: LegacyGalleryReceipt) => Promise<void>;
};

/** Copies the gallery byte for byte; cards, masters and old public URLs stay intact. */
export async function backfillLegacyGallery(photo: LegacyGalleryPhoto, io: LegacyGalleryIO, storageOrigin = PHOTO_STORAGE_ORIGIN) {
  const plan = legacyGalleryPlan(photo.url, storageOrigin);
  if (!plan) return { status: "skipped" as const };
  const original = await io.read(plan.sourcePath);
  const preview = await encodeGalleryPreview(original);
  await io.put(plan.previewPath, preview.buffer, preview.contentType);
  await io.put(plan.galleryPath, original, plan.contentType);
  const receipt: LegacyGalleryReceipt = { ...photo, nextUrl: plan.galleryUrl, previewBytes: preview.buffer.length, originalBytes: original.length };
  await io.journal(receipt);
  const changed = await io.replace(photo.id, photo.url, plan.galleryUrl);
  return { status: changed ? "updated" as const : "superseded" as const, receipt };
}
