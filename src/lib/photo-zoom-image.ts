import sharp from "sharp";

export const ZOOM_MAX_EDGE = 2200;
export const ZOOM_MAX_BYTES = 500 * 1024;
const TARGET_BYTES = 350 * 1024;

/** Uma cópia WebP sem metadados; o JPEG privado nunca é devolvido. */
export async function encodeZoomImage(source: Uint8Array): Promise<Buffer | null> {
  const image = sharp(Buffer.from(source), { failOn: "none", limitInputPixels: 40_000_000 }).autoOrient();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || Math.max(metadata.width, metadata.height) <= 1280) return null;
  for (const [edge, quality] of [[2200, 78], [2200, 70], [1920, 66]] as const) {
    const bytes = await image.clone().resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 6 }).toBuffer();
    if (bytes.length <= TARGET_BYTES || (edge === 1920 && bytes.length <= ZOOM_MAX_BYTES)) return bytes;
  }
  return null;
}
