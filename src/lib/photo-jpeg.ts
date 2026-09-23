import sharp from "sharp";
import { ADMIN_JPEG_QUALITY } from "@/lib/photo-master";

/**
 * JPEG da galeria (foto já ≤1280). A página pública continua em WebP.
 * Download de foto fica só no painel admin.
 */
export const DOWNLOAD_JPEG_QUALITY = 90;

export { ADMIN_JPEG_QUALITY };

function isJpeg(bytes: Uint8Array) {
  return (
    bytes.byteLength >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

/**
 * Converte para JPEG sem reduzir pixels.
 * JPEG que já está guardado passa direto, sem reencode.
 */
export async function toDownloadJpeg(
  bytes: Uint8Array,
  quality = DOWNLOAD_JPEG_QUALITY,
): Promise<Uint8Array> {
  if (isJpeg(bytes)) return bytes;

  const encoded = await sharp(Buffer.from(bytes), { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  return new Uint8Array(encoded);
}

/** Master privado: pixels de entrada inteiros, JPEG 93. Sem URL pública. */
export async function encodeMasterJpeg(bytes: Uint8Array): Promise<Uint8Array> {
  const encoded = await sharp(Buffer.from(bytes), { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: ADMIN_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  return new Uint8Array(encoded);
}
