import sharp from "sharp";

export const GALLERY_MAX_EDGE = 1280;
export const CARD_WIDTH = 480;
export const CARD_HEIGHT = 300;
export const GALLERY_QUALITY = 72;
export const CARD_QUALITY = 65;

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
    .webp({ quality: GALLERY_QUALITY, effort: 4 })
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
    .webp({ quality: CARD_QUALITY, effort: 4 })
    .toBuffer();

  return { buffer: optimized, contentType: "image/webp", extension: "webp" };
}

export function cardObjectPath(galleryPath: string) {
  return galleryPath.replace(/(\.[a-z0-9]+)?$/i, "-card.webp");
}
