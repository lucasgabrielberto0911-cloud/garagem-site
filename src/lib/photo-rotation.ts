import sharp from "sharp";
export type PhotoRotation = 90 | 180 | 270;
export function parsePhotoRotation(value: unknown): PhotoRotation | null {
  return value === 90 || value === 180 || value === 270 ? value : null;
}
/** Auto-orient first, then apply the same clockwise turn shown in the preview. */
export async function rotatePhoto(bytes: Uint8Array, degrees: PhotoRotation) {
  return sharp(Buffer.from(bytes)).autoOrient().rotate(degrees).png({ compressionLevel: 1 }).toBuffer();
}
