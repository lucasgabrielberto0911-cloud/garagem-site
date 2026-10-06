import { galleryStemFromStoragePath } from "./photo-master";

export function zoomObjectPath(galleryPath: string) {
  if (galleryPath.includes("/") || /-(?:card|zoom)\.webp$/i.test(galleryPath)) return null;
  const stem = galleryStemFromStoragePath(galleryPath);
  return stem ? stem + "-zoom.webp" : null;
}

export function ownGalleryPath(url: string, storageUrl: string) {
  try {
    const source = new URL(url), base = new URL(storageUrl);
    const prefix = "/storage/v1/object/public/veiculos/";
    if (source.protocol !== "https:" || source.origin !== base.origin || source.search || source.hash || !source.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(source.pathname.slice(prefix.length));
    return zoomObjectPath(path) ? path : null;
  } catch { return null; }
}
