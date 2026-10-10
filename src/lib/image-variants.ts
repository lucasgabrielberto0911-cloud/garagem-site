import sharp from "sharp";
import { COVER_HD_HEIGHT, COVER_HD_WIDTH, coverCropRect, wantsHdCard, type CoverFrame } from "./cover-frame";

export const GALLERY_MAX_EDGE = 1280;
export const CARD_WIDTH = 480;
export const CARD_HEIGHT = 360;
export const GALLERY_QUALITY = 78;
export const CARD_QUALITY = 74;
/** Mesmo q75 do 720/960 ao vivo da capa automática. */
export const CARD_HD_QUALITY = 75;

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

export type FramedCardSet = {
  /** 480×360 (o `thumbnailUrl`). */
  card: EncodedImage;
  /** 960×720 com o mesmo recorte; null se a foto não tem resolução para isso. */
  hd: EncodedImage | null;
};

/**
 * Capa a partir da janela escolhida no admin: 480×360 e, quando o recorte tem
 * pelo menos 720 px de largura na foto-fonte, também 960×720 (telas largas e
 * densas). As medidas já consideram a orientação EXIF, igual ao `rotate()` do
 * resto do pipeline. Os dois tamanhos saem do mesmo `rect`.
 */
export async function encodeFramedCardSet(buffer: Buffer, frame: CoverFrame): Promise<FramedCardSet> {
  const { width = 0, height = 0, orientation = 1 } = await sharp(buffer, { failOn: "none" }).metadata();
  if (!width || !height) throw new Error("Foto sem dimensões.");
  const sideways = orientation >= 5;
  const rect = coverCropRect(sideways ? height : width, sideways ? width : height, frame);
  const encode = async (w: number, h: number, quality: number): Promise<EncodedImage> => ({
    buffer: await sharp(buffer, { failOn: "none" })
      .rotate()
      .extract(rect)
      .resize({ width: w, height: h, fit: "fill" })
      .webp({ quality, effort: 6 })
      .toBuffer(),
    contentType: "image/webp",
    extension: "webp",
  });
  const [card, hd] = await Promise.all([
    encode(CARD_WIDTH, CARD_HEIGHT, CARD_QUALITY),
    wantsHdCard(rect) ? encode(COVER_HD_WIDTH, COVER_HD_HEIGHT, CARD_HD_QUALITY) : Promise.resolve(null),
  ]);
  return { card, hd };
}

/** Só o 480×360 da janela escolhida. */
export async function encodeFramedCardImage(buffer: Buffer, frame: CoverFrame): Promise<EncodedImage> {
  return (await encodeFramedCardSet(buffer, frame)).card;
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
