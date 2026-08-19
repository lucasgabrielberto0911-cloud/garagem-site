import {
  DetectTextCommand,
  RekognitionClient,
  type BoundingBox,
  type TextDetection,
} from "@aws-sdk/client-rekognition";
import sharp from "sharp";

const PLATE_MARGIN = 0.22;
const BLUR_SIGMA = 28;
/** DetectText via bytes aceita no máximo ~5 MB. */
const REKOGNITION_MAX_BYTES = 4.5 * 1024 * 1024;

const OLD_PLATE = /^[A-Z]{3}\d{4}$/;
const MERCOSUL_PLATE = /^[A-Z]{3}\d[A-Z]\d{2}$/;

type PixelBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type TextPiece = {
  text: string;
  box: PixelBox;
  type: string;
};

export function hasPlateBlurConfigured() {
  return (
    Boolean(process.env.AWS_ACCESS_KEY_ID?.trim()) &&
    Boolean(process.env.AWS_SECRET_ACCESS_KEY?.trim())
  );
}

function getRekognitionClient() {
  const region = process.env.AWS_REGION?.trim() || "us-east-1";
  return new RekognitionClient({ region });
}

function compactAlphanumeric(text: string) {
  return text.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

function asLetter(char: string) {
  const value = char.toUpperCase();
  if (value === "0") return "O";
  if (value === "1") return "I";
  if (value === "5") return "S";
  if (value === "8") return "B";
  return value;
}

function asDigit(char: string) {
  const value = char.toUpperCase();
  if (value === "O") return "0";
  if (value === "I" || value === "L") return "1";
  if (value === "S") return "5";
  if (value === "B") return "8";
  if (value === "G") return "6";
  return value;
}

function forceOldPlate(value: string) {
  if (value.length !== 7) return value;
  return (
    asLetter(value[0]) +
    asLetter(value[1]) +
    asLetter(value[2]) +
    asDigit(value[3]) +
    asDigit(value[4]) +
    asDigit(value[5]) +
    asDigit(value[6])
  );
}

function forceMercosulPlate(value: string) {
  if (value.length !== 7) return value;
  return (
    asLetter(value[0]) +
    asLetter(value[1]) +
    asLetter(value[2]) +
    asDigit(value[3]) +
    asLetter(value[4]) +
    asDigit(value[5]) +
    asDigit(value[6])
  );
}

function isSevenCharPlate(value: string) {
  if (value.length !== 7) return false;
  return (
    OLD_PLATE.test(value) ||
    MERCOSUL_PLATE.test(value) ||
    OLD_PLATE.test(forceOldPlate(value)) ||
    MERCOSUL_PLATE.test(forceMercosulPlate(value))
  );
}

/**
 * O Rekognition quase nunca devolve só "ABC1D23": vem "BR ABC1D23",
 * cidade, ou a placa partida em palavras. Por isso varremos janelas de 7.
 */
export function textLooksLikePlate(text: string | undefined) {
  if (!text) return false;
  const compact = compactAlphanumeric(text);
  if (compact.length < 7) return false;
  if (isSevenCharPlate(compact)) return true;
  for (let index = 0; index <= compact.length - 7; index += 1) {
    if (isSevenCharPlate(compact.slice(index, index + 7))) return true;
  }
  return false;
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

function unionBox(boxes: PixelBox[]): PixelBox {
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  return { left, top, width: right - left, height: bottom - top };
}

function areNearby(a: PixelBox, b: PixelBox) {
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const bx = b.left + b.width / 2;
  const by = b.top + b.height / 2;
  const maxDim = Math.max(a.width, a.height, b.width, b.height, 1);
  return Math.hypot(ax - bx, ay - by) < maxDim * 2.4;
}

function readingOrder(pieces: TextPiece[]) {
  return [...pieces].sort((a, b) => {
    const rowThreshold = Math.min(a.box.height, b.box.height) * 0.65;
    if (Math.abs(a.box.top - b.box.top) < rowThreshold) {
      return a.box.left - b.box.left;
    }
    return a.box.top - b.box.top;
  });
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

function piecesFromDetections(
  detections: TextDetection[],
  imageWidth: number,
  imageHeight: number,
): TextPiece[] {
  const pieces: TextPiece[] = [];
  for (const item of detections) {
    if (item.Type !== "LINE" && item.Type !== "WORD") continue;
    const text = item.DetectedText?.trim();
    if (!text) continue;
    const geometry = item.Geometry?.BoundingBox;
    if (!geometry) continue;
    const box = boxToPixels(geometry, imageWidth, imageHeight);
    if (!box) continue;
    pieces.push({ text, box, type: item.Type });
  }
  return pieces;
}

function boxesFromPieces(pieces: TextPiece[]): PixelBox[] {
  const boxes: PixelBox[] = [];

  for (const piece of pieces) {
    if (textLooksLikePlate(piece.text)) boxes.push(piece.box);
  }

  const words = pieces.filter((piece) => piece.type === "WORD");
  for (let i = 0; i < words.length; i += 1) {
    for (let j = i + 1; j < words.length; j += 1) {
      if (!areNearby(words[i].box, words[j].box)) continue;
      const pair = readingOrder([words[i], words[j]]);
      const pairText = pair.map((item) => item.text).join("");
      if (textLooksLikePlate(pairText)) {
        boxes.push(unionBox(pair.map((item) => item.box)));
      }

      for (let k = j + 1; k < words.length; k += 1) {
        if (
          !areNearby(words[i].box, words[k].box) &&
          !areNearby(words[j].box, words[k].box)
        ) {
          continue;
        }
        const triple = readingOrder([words[i], words[j], words[k]]);
        const tripleText = triple.map((item) => item.text).join("");
        if (textLooksLikePlate(tripleText)) {
          boxes.push(unionBox(triple.map((item) => item.box)));
        }
      }
    }
  }

  return mergeOverlappingBoxes(boxes);
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
  if (!hasPlateBlurConfigured()) {
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

    const client = getRekognitionClient();
    const response = await client.send(
      new DetectTextCommand({
        Image: { Bytes: bytes },
      }),
    );

    const detections = response.TextDetections ?? [];
    const pieces = piecesFromDetections(detections, width, height);
    const boxes = boxesFromPieces(pieces);

    if (boxes.length === 0) {
      const sample = pieces
        .map((piece) => piece.text)
        .filter(Boolean)
        .slice(0, 16);
      console.warn(
        "[blur-plates] nenhuma placa reconhecida.",
        sample.length ? `textos: ${sample.join(" | ")}` : "sem texto na imagem",
      );
      return input;
    }

    console.info(
      `[blur-plates] ${boxes.length} região(ões) de placa detectada(s) — aplicando blur.`,
    );

    return await applyBlurRegions(bytes, boxes);
  } catch (error) {
    console.error("[blur-plates] falha no Rekognition/blur — upload segue:", error);
    return input;
  }
}
