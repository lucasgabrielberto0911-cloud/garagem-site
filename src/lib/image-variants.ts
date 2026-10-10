import sharp from "sharp";
import { coverCropRect, type CoverFrame } from "./cover-frame";

export const GALLERY_MAX_EDGE = 1280;
export const CARD_WIDTH = 480;
export const CARD_HEIGHT = 360;
export const GALLERY_QUALITY = 78;
export const CARD_QUALITY = 74;

export type EncodedImage = {
  buffer: Buffer;
  contentType: "image/webp";
  extension: "webp";
};

export async function encodeGalleryImage(buffer: Buffer): Promise<EncodedImage> {
  const optimized = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: GALLERY_MAX_EDGE,
      height: GALLERY_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: GALLERY_QUALITY, effort: 6 })
    .toBuffer();

  return { buffer: optimized, contentType: "image/webp", extension: "webp" };
}

export async function encodeCardImage(buffer: Buffer): Promise<EncodedImage> {
  const optimized = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: CARD_QUALITY, effort: 6 })
    .toBuffer();

  return { buffer: optimized, contentType: "image/webp", extension: "webp" };
}

/**
 * Capa 480×360 a partir da janela escolhida no admin. As medidas da foto já
 * consideram a orientação EXIF, igual ao `rotate()` do resto do pipeline.
 */
export async function encodeFramedCardImage(buffer: Buffer, frame: CoverFrame): Promise<EncodedImage> {
  const { width = 0, height = 0, orientation = 1 } = await sharp(buffer, { failOn: "none" }).metadata();
  if (!width || !height) throw new Error("Foto sem dimensões.");
  const sideways = orientation >= 5;
  const rect = coverCropRect(sideways ? height : width, sideways ? width : height, frame);
  const optimized = await sharp(buffer, { failOn: "none" })
    .rotate()
    .extract(rect)
    .resize({ width: CARD_WIDTH, height: CARD_HEIGHT, fit: "fill" })
    .webp({ quality: CARD_QUALITY, effort: 6 })
    .toBuffer();

  return { buffer: optimized, contentType: "image/webp", extension: "webp" };
}

/** Mesmos 800 px / q80 do render móvel, preservando proporção e orientação. */
export async function encodeGalleryPreview(buffer: Buffer): Promise<EncodedImage> {
  const optimized = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 800, withoutEnlargement: true })
    .webp({ quality: 80, effort: 6 })
    .toBuffer();
  return { buffer: optimized, contentType: "image/webp", extension: "webp" };
}

export function cardObjectPath(galleryPath: string) {
  return galleryPath.replace(/(\.[a-z0-9]+)?$/i, "-card.webp");
}
