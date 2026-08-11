import {
  DetectTextCommand,
  RekognitionClient,
  type BoundingBox,
  type TextDetection,
} from "@aws-sdk/client-rekognition";
import sharp from "sharp";
import { isValidPlate, normalizePlate } from "@/lib/format";

const PLATE_MARGIN = 0.15;
const BLUR_SIGMA = 20;
/** DetectText via bytes aceita no máximo ~5 MB. */
const REKOGNITION_MAX_BYTES = 4.5 * 1024 * 1024;

type PixelBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function getRekognitionClient() {
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  return new RekognitionClient({ region });
}

function looksLikePlate(text: string | undefined) {
  if (!text) return false;
  return isValidPlate(normalizePlate(text));
}

function boxToPixels(
  box: BoundingBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox | null {
  const leftRatio = box.Left ?? 0;
  const topRatio = box.Top ?? 0;
  const widthRatio = box.Width ?? 0;
  const heightRatio = box.Height ?? 0;

  if (widthRatio <= 0 || heightRatio <= 0) return null;

  const padX = widthRatio * PLATE_MARGIN;
  const padY = heightRatio * PLATE_MARGIN;

  let left = Math.floor((leftRatio - padX) * imageWidth);
  let top = Math.floor((topRatio - padY) * imageHeight);
  let right = Math.ceil((leftRatio + widthRatio + padX) * imageWidth);
  let bottom = Math.ceil((topRatio + heightRatio + padY) * imageHeight);

  left = Math.max(0, left);
  top = Math.max(0, top);
  right = Math.min(imageWidth, right);
  bottom = Math.min(imageHeight, bottom);

  const width = right - left;
  const height = bottom - top;
  if (width < 4 || height < 4) return null;

  return { left, top, width, height };
}

/**
 * Prepara bytes JPEG para o DetectText (Rekognition não aceita HEIC e
 * limita ~5 MB no modo bytes).
 */
async function toRekognitionJpeg(input: Buffer): Promise<{
  bytes: Buffer;
  width: number;
  height: number;
}> {
  const rotated = sharp(input, { failOn: "none" }).rotate();
  const meta = await rotated.metadata();
  let width = meta.width ?? 0;
  let height = meta.height ?? 0;
  let maxEdge = Math.max(width, height, 1);
  let quality = 90;

  let bytes = await rotated.jpeg({ quality, mozjpeg: true }).toBuffer();

  // DetectText via bytes aceita ~5 MB — reduz qualidade/lado se precisar.
  while (bytes.length > REKOGNITION_MAX_BYTES && (quality > 40 || maxEdge > 1200)) {
    if (bytes.length > REKOGNITION_MAX_BYTES && maxEdge > 1200) {
      maxEdge = Math.round(maxEdge * 0.85);
    } else {
      quality -= 10;
    }

    const resized = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    bytes = resized.data;
    width = resized.info.width;
    height = resized.info.height;
    maxEdge = Math.max(width, height, 1);
  }

  if (!width || !height) {
    const again = await sharp(bytes, { failOn: "none" }).metadata();
    width = again.width ?? 0;
    height = again.height ?? 0;
  }

  return { bytes, width, height };
}

async function detectPlateBoxes(
  imageBytes: Buffer,
  imageWidth: number,
  imageHeight: number,
): Promise<PixelBox[]> {
  const client = getRekognitionClient();
  const response = await client.send(
    new DetectTextCommand({
      Image: { Bytes: imageBytes },
    }),
  );

  const detections = response.TextDetections ?? [];
  const boxes: PixelBox[] = [];

  for (const item of detections) {
    if (!isPlateDetection(item)) continue;
    const geometry = item.Geometry?.BoundingBox;
    if (!geometry) continue;
    const pixels = boxToPixels(geometry, imageWidth, imageHeight);
    if (pixels) boxes.push(pixels);
  }

  return mergeOverlappingBoxes(boxes);
}

function isPlateDetection(item: TextDetection) {
  // Prefere LINE; WORD também cobre placa partida em pedaços.
  if (item.Type !== "LINE" && item.Type !== "WORD") return false;
  return looksLikePlate(item.DetectedText);
}

/** Une boxes que se sobrepõem bastante (mesmo placa, LINE + WORD). */
function mergeOverlappingBoxes(boxes: PixelBox[]): PixelBox[] {
  if (boxes.length <= 1) return boxes;

  const sorted = [...boxes].sort((a, b) => a.left - b.left || a.top - b.top);
  const merged: PixelBox[] = [];

  for (const box of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...box });
      continue;
    }

    const overlap =
      box.left < prev.left + prev.width &&
      box.left + box.width > prev.left &&
      box.top < prev.top + prev.height &&
      box.top + box.height > prev.top;

    if (overlap) {
      const right = Math.max(prev.left + prev.width, box.left + box.width);
      const bottom = Math.max(prev.top + prev.height, box.top + box.height);
      prev.left = Math.min(prev.left, box.left);
      prev.top = Math.min(prev.top, box.top);
      prev.width = right - prev.left;
      prev.height = bottom - prev.top;
    } else {
      merged.push({ ...box });
    }
  }

  return merged;
}

async function applyBlurRegions(
  image: Buffer,
  boxes: PixelBox[],
): Promise<Buffer> {
  if (boxes.length === 0) return image;

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const box of boxes) {
    const blurred = await sharp(image, { failOn: "none" })
      .extract({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      })
      .blur(BLUR_SIGMA)
      .toBuffer();

    composites.push({
      input: blurred,
      left: box.left,
      top: box.top,
    });
  }

  return sharp(image, { failOn: "none" }).composite(composites).toBuffer();
}

/**
 * Detecta placas BR via AWS Rekognition DetectText e aplica blur forte.
 * Em qualquer falha, devolve o buffer original (nunca bloqueia o upload).
 */
export async function blurDetectedPlates(input: Buffer): Promise<Buffer> {
  const hasAws =
    Boolean(process.env.AWS_ACCESS_KEY_ID?.trim()) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY?.trim());

  if (!hasAws) {
    console.warn(
      "[blur-plates] AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY ausentes — pulando blur.",
    );
    return input;
  }

  try {
    const { bytes, width, height } = await toRekognitionJpeg(input);
    if (!width || !height) {
      console.warn("[blur-plates] não foi possível ler dimensões da imagem.");
      return input;
    }

    const boxes = await detectPlateBoxes(bytes, width, height);
    if (boxes.length === 0) {
      return input;
    }

    console.info(
      `[blur-plates] ${boxes.length} região(ões) de placa detectada(s) — aplicando blur.`,
    );

    // Blur sobre o JPEG usado na detecção (mesmas coordenadas).
    return await applyBlurRegions(bytes, boxes);
  } catch (error) {
    console.error("[blur-plates] falha no Rekognition/blur — upload segue:", error);
    return input;
  }
}
