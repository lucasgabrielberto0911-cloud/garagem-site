import {
  DetectTextCommand,
  RekognitionClient,
  type BoundingBox,
  type TextDetection,
} from "@aws-sdk/client-rekognition";
import sharp from "sharp";

/** Folga curta depois de achar a placa — só a faixa, sem comer o para-choque. */
const PLATE_PAD_X = 0.08;
const PLATE_PAD_Y = 0.1;
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

/** Placa (7) ou BR + placa (8–9). Textos longos (cidade, linha inteira) ficam de fora. */
function isTightPlateText(text: string) {
  const length = compactAlphanumeric(text).length;
  return length >= 7 && length <= 9 && textLooksLikePlate(text);
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

  const left = Math.max(0, Math.floor(leftRatio * imageWidth));
  const top = Math.max(0, Math.floor(topRatio * imageHeight));
  const right = Math.min(imageWidth, Math.ceil((leftRatio + widthRatio) * imageWidth));
  const bottom = Math.min(imageHeight, Math.ceil((topRatio + heightRatio) * imageHeight));
  const width = right - left;
  const height = bottom - top;
  if (width < 4 || height < 4) return null;

  return { left, top, width, height };
}

function padBox(box: PixelBox, imageWidth: number, imageHeight: number): PixelBox {
  const padX = Math.max(2, Math.round(box.width * PLATE_PAD_X));
  const padY = Math.max(2, Math.round(box.height * PLATE_PAD_Y));
  const left = Math.max(0, box.left - padX);
  const top = Math.max(0, box.top - padY);
  const right = Math.min(imageWidth, box.left + box.width + padX);
  const bottom = Math.min(imageHeight, box.top + box.height + padY);
  return { left, top, width: right - left, height: bottom - top };
}

function unionBox(boxes: PixelBox[]): PixelBox {
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  return { left, top, width: right - left, height: bottom - top };
}

function boxArea(box: PixelBox) {
  return box.width * box.height;
}

function smallerBox(a: PixelBox, b: PixelBox) {
  return boxArea(a) <= boxArea(b) ? a : b;
}

function boxesOverlap(a: PixelBox, b: PixelBox) {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function isPlateShaped(box: PixelBox, imageWidth: number, imageHeight: number) {
  if (box.width < 16 || box.height < 8) return false;
  const aspect = box.width / box.height;
  const areaRatio = boxArea(box) / (imageWidth * imageHeight);
  if (areaRatio > 0.05) return false;
  if (box.width > imageWidth * 0.28) return false;
  if (box.height > imageHeight * 0.11) return false;
  if (aspect < 0.7) return false;
  if (aspect > 6.5) return false;
  return true;
}

/**
 * Se o Rekognition devolver uma faixa alta (lateral do carro, linha com cidade),
 * recorta para o tamanho de uma placa na base da região.
 */
function clampToPlateShape(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox {
  const maxW = Math.max(24, Math.round(imageWidth * 0.2));
  const maxH = Math.max(14, Math.round(imageHeight * 0.085));
  let { left, top, width, height } = box;

  if (width > maxW) {
    left += Math.round((width - maxW) / 2);
    width = maxW;
  }
  if (height > maxH) {
    top += height - maxH;
    height = maxH;
  }

  const aspect = width / Math.max(1, height);
  if (aspect < 0.85) {
    const targetH = Math.max(12, Math.round(width / 2.6));
    if (height > targetH) {
      top += height - targetH;
      height = targetH;
    }
  }

  left = Math.max(0, Math.min(left, Math.max(0, imageWidth - width)));
  top = Math.max(0, Math.min(top, Math.max(0, imageHeight - height)));
  return { left, top, width, height };
}

function areNearby(a: PixelBox, b: PixelBox) {
  const ax2 = a.left + a.width;
  const ay2 = a.top + a.height;
  const bx2 = b.left + b.width;
  const by2 = b.top + b.height;
  const gapX = Math.max(0, Math.max(a.left, b.left) - Math.min(ax2, bx2));
  const gapY = Math.max(0, Math.max(a.top, b.top) - Math.min(ay2, by2));
  const similarH =
    Math.min(a.height, b.height) / Math.max(a.height, b.height) > 0.4;
  const sameRow = gapY <= Math.max(a.height, b.height) * 0.35;
  const stacked = gapX <= Math.max(a.width, b.width) * 0.35;
  if (sameRow && similarH) return gapX <= Math.max(a.width, b.width) * 0.55;
  if (stacked && similarH) return gapY <= Math.max(a.height, b.height) * 0.7;
  return false;
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

function boxesFromPieces(
  pieces: TextPiece[],
  imageWidth: number,
  imageHeight: number,
): PixelBox[] {
  const boxes: PixelBox[] = [];
  const seen = new Set<string>();

  const addBox = (box: PixelBox) => {
    const clamped = clampToPlateShape(box, imageWidth, imageHeight);
    if (!isPlateShaped(clamped, imageWidth, imageHeight)) return;
    const key = `${clamped.left},${clamped.top},${clamped.width},${clamped.height}`;
    if (seen.has(key)) return;
    seen.add(key);
    boxes.push(clamped);
  };

  const words = pieces.filter((piece) => piece.type === "WORD");

  for (const word of words) {
    if (isTightPlateText(word.text)) addBox(word.box);
  }

  for (let i = 0; i < words.length; i += 1) {
    for (let j = i + 1; j < words.length; j += 1) {
      if (!areNearby(words[i].box, words[j].box)) continue;
      const pair = readingOrder([words[i], words[j]]);
      const pairText = pair.map((item) => item.text).join("");
      if (isTightPlateText(pairText)) {
        addBox(unionBox(pair.map((item) => item.box)));
      }

      for (let k = j + 1; k < words.length; k += 1) {
        if (
          !areNearby(words[i].box, words[k].box) &&
          !areNearby(words[j].box, words[k].box)
        ) {
          continue;
        }
        const triple = readingOrder([words[i], words[j], words[k]]);
        const a = triple[0];
        const b = triple[1];
        const c = triple[2];
        if (!areNearby(a.box, b.box) || !areNearby(b.box, c.box)) continue;
        const tripleText = triple.map((item) => item.text).join("");
        if (isTightPlateText(tripleText)) {
          addBox(unionBox(triple.map((item) => item.box)));
        }
      }
    }
  }

  if (boxes.length === 0) {
    for (const line of pieces.filter((piece) => piece.type === "LINE")) {
      if (!textLooksLikePlate(line.text)) continue;
      addBox(line.box);
    }
  }

  return mergeOverlappingBoxes(boxes).map((box) =>
    padBox(box, imageWidth, imageHeight),
  );
}

/** Quando dois achados se sobrepõem, fica o menor — a linha gorda não engole a placa. */
function mergeOverlappingBoxes(boxes: PixelBox[]): PixelBox[] {
  if (boxes.length <= 1) return boxes;

  const sorted = [...boxes].sort(
    (a, b) => boxArea(a) - boxArea(b) || a.left - b.left || a.top - b.top,
  );
  const merged: PixelBox[] = [];

  for (const box of sorted) {
    const overlapIndex = merged.findIndex((item) => boxesOverlap(item, box));
    if (overlapIndex === -1) {
      merged.push({ ...box });
      continue;
    }
    merged[overlapIndex] = smallerBox(merged[overlapIndex], box);
  }

  return merged;
}

async function applyBlurRegions(image: Buffer, boxes: PixelBox[]): Promise<Buffer> {
  if (boxes.length === 0) return image;

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const box of boxes) {
    if (box.width < 4 || box.height < 4) continue;

    const sigma = Math.min(
      12,
      Math.max(4, Math.round(Math.min(box.width, box.height) / 8)),
    );
    const radius = Math.max(3, Math.round(Math.min(box.width, box.height) * 0.2));
    const feather = Math.max(1.2, Math.min(box.width, box.height) * 0.07);
    const inset = Math.max(1, Math.round(feather));
    const mask = Buffer.from(
      `<svg width="${box.width}" height="${box.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="feather" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="${feather}" />
          </filter>
        </defs>
        <rect
          x="${inset}"
          y="${inset}"
          width="${Math.max(1, box.width - inset * 2)}"
          height="${Math.max(1, box.height - inset * 2)}"
          rx="${radius}"
          ry="${radius}"
          fill="white"
          filter="url(#feather)"
        />
      </svg>`,
    );

    const blurred = await sharp(image, { failOn: "none" })
      .extract({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      })
      .blur(sigma)
      .toBuffer();

    const masked = await sharp(blurred)
      .ensureAlpha()
      .composite([{ input: mask, blend: "dest-in" }])
      .png()
      .toBuffer();

    composites.push({
      input: masked,
      left: box.left,
      top: box.top,
    });
  }

  if (composites.length === 0) return image;

  return sharp(image, { failOn: "none" }).composite(composites).toBuffer();
}

/**
 * Detecta placas BR via AWS Rekognition DetectText e aplica blur pequeno
 * só na faixa da placa, com borda suave para não tapar o carro.
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
    const boxes = boxesFromPieces(pieces, width, height);

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
      `[blur-plates] ${boxes.length} região(ões) de placa detectada(s) — aplicando blur sutil.`,
    );

    return await applyBlurRegions(bytes, boxes);
  } catch (error) {
    console.error("[blur-plates] falha no Rekognition/blur — upload segue:", error);
    return input;
  }
}
