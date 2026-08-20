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
const MIN_WORD_CONFIDENCE = 80;
const LETTER_FROM_DIGIT: Record<string, string> = {
  "0": "O",
  "1": "I",
  "5": "S",
  "8": "B",
};
const DIGIT_FROM_LETTER: Record<string, string> = {
  O: "0",
  I: "1",
  L: "1",
  S: "5",
  B: "8",
  G: "6",
};

/** Siglas de painel/moto que o OCR junta com números e “vira placa”. */
const DASHBOARD_TOKENS = new Set([
  "ABS",
  "ASR",
  "TCS",
  "ESC",
  "ESP",
  "EBD",
  "DRL",
  "EFI",
  "ECU",
  "ECO",
  "TRIP",
  "ODO",
  "RPM",
  "KMH",
  "MPH",
  "TEMP",
  "OIL",
  "FUEL",
  "VOLT",
  "WATER",
  "ENGINE",
  "BRAKE",
  "HOLD",
  "READY",
  "MODE",
  "SPORT",
  "CHECK",
  "SRS",
  "AIRBAG",
  "TFT",
  "LCD",
  "HUD",
  "GPS",
  "HONDA",
  "YAMAHA",
  "SUZUKI",
  "KAWASAKI",
  "DUCATI",
  "TRIUMPH",
  "SHINERAY",
  "HAOJUE",
  "PAINEL",
  "MARCHA",
  "NEUTRO",
  "AUTONOMIA",
  "CONSUMO",
  "FAROL",
  "COMBUSTIVEL",
  "TEMPERATURA",
  "VELOCIDADE",
  "ODOMETRO",
  "NMAX",
  "PCX",
]);

/** Prefixo LLL que, sozinho no painel, não é placa (ABS 1234, ECO 1234…). */
const FALSE_PLATE_PREFIXES = new Set([
  "ABS",
  "ASR",
  "TCS",
  "ESC",
  "ESP",
  "EBD",
  "DRL",
  "LED",
  "HUD",
  "GPS",
  "LCD",
  "ECU",
  "EFI",
  "DTC",
  "OBD",
  "RPM",
  "ECO",
  "OIL",
  "AIR",
  "SRS",
  "BAG",
  "TMP",
  "ECT",
  "USB",
  "AUX",
  "AVG",
  "STD",
  "KMH",
  "MPH",
  "TFT",
  "ODO",
  "CEL",
  "MIL",
  "ATF",
  "CVT",
  "DCT",
]);

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
  confidence: number;
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

function normalizeToken(text: string) {
  return compactAlphanumeric(text);
}

function isDashboardToken(text: string) {
  const compact = normalizeToken(text);
  if (!compact) return false;
  if (DASHBOARD_TOKENS.has(compact)) return true;
  const upper = text.toUpperCase();
  return /KM\s*\/\s*H/.test(upper) || upper.includes("KM/H");
}

function matchesSlotPattern(
  value: string,
  slots: Array<"L" | "D">,
  maxSwaps: number,
) {
  if (value.length !== slots.length) return false;
  let swaps = 0;
  let built = "";
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const slot = slots[index];
    if (slot === "L") {
      if (/[A-Z]/.test(char)) {
        built += char;
      } else if (LETTER_FROM_DIGIT[char]) {
        built += LETTER_FROM_DIGIT[char];
        swaps += 1;
      } else {
        return false;
      }
    } else if (/\d/.test(char)) {
      built += char;
    } else if (DIGIT_FROM_LETTER[char]) {
      built += DIGIT_FROM_LETTER[char];
      swaps += 1;
    } else {
      return false;
    }
  }
  if (swaps > maxSwaps) return false;
  return slots[4] === "L" ? MERCOSUL_PLATE.test(built) : OLD_PLATE.test(built);
}

function isActualPlate(value: string) {
  if (value.length !== 7) return false;
  if (FALSE_PLATE_PREFIXES.has(value.slice(0, 3))) return false;
  if (OLD_PLATE.test(value) || MERCOSUL_PLATE.test(value)) return true;
  return (
    matchesSlotPattern(value, ["L", "L", "L", "D", "D", "D", "D"], 2) ||
    matchesSlotPattern(value, ["L", "L", "L", "D", "L", "D", "D"], 2)
  );
}

/**
 * Placa BR (7) ou BR + placa (9). Sem janela deslizante: texto de painel
 * tipo "ABS 1234 km/h" não pode virar placa.
 */
export function textLooksLikePlate(text: string | undefined) {
  if (!text) return false;
  const compact = compactAlphanumeric(text);
  if (compact.length === 7) return isActualPlate(compact);
  if (compact.startsWith("BR") && compact.length === 9) {
    return isActualPlate(compact.slice(2));
  }
  return false;
}

function isTightPlateText(text: string) {
  return textLooksLikePlate(text);
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
  if (areaRatio > 0.04) return false;
  if (box.width > imageWidth * 0.26) return false;
  if (box.height > imageHeight * 0.1) return false;
  if (aspect < 0.75) return false;
  if (aspect > 6) return false;
  return true;
}

/** Caixa crua grande demais (display do painel) não é placa — nem recortando. */
function isPlausiblePlateBox(box: PixelBox, imageWidth: number, imageHeight: number) {
  const areaRatio = boxArea(box) / (imageWidth * imageHeight);
  if (areaRatio > 0.045) return false;
  if (box.width > imageWidth * 0.32) return false;
  if (box.height > imageHeight * 0.14) return false;
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

function collectTokens(pieces: TextPiece[]) {
  const tokens = new Set<string>();
  for (const piece of pieces) {
    const upper = piece.text.toUpperCase();
    if (/KM\s*\/\s*H/.test(upper) || upper.includes("KM/H")) tokens.add("KMH");
    const compact = normalizeToken(piece.text);
    if (compact) tokens.add(compact);
    for (const part of upper.split(/[^A-Z0-9]+/)) {
      if (part.length >= 2) tokens.add(part);
    }
  }
  return Array.from(tokens);
}

function looksLikeInstrumentCluster(pieces: TextPiece[]) {
  const words = pieces.filter((piece) => piece.type === "WORD");
  const tokens = collectTokens(pieces);
  let hits = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    if (DASHBOARD_TOKENS.has(tokens[index])) hits += 1;
  }
  const numericWords = words.filter((piece) =>
    /^\d+[.,:]?\d*$/.test(piece.text.trim()),
  ).length;
  if (hits >= 2) return true;
  if (hits >= 1 && numericWords >= 3) return true;
  if (words.length >= 10 && numericWords >= 5) return true;
  return false;
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
    const confidence = item.Confidence ?? 0;
    if (item.Type === "WORD" && confidence < MIN_WORD_CONFIDENCE) continue;
    const geometry = item.Geometry?.BoundingBox;
    if (!geometry) continue;
    const box = boxToPixels(geometry, imageWidth, imageHeight);
    if (!box) continue;
    pieces.push({ text, box, type: item.Type, confidence });
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
    if (!isPlausiblePlateBox(box, imageWidth, imageHeight)) return;
    const clamped = clampToPlateShape(box, imageWidth, imageHeight);
    if (!isPlateShaped(clamped, imageWidth, imageHeight)) return;
    const key = `${clamped.left},${clamped.top},${clamped.width},${clamped.height}`;
    if (seen.has(key)) return;
    seen.add(key);
    boxes.push(clamped);
  };

  const words = pieces.filter(
    (piece) => piece.type === "WORD" && !isDashboardToken(piece.text),
  );

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

async function looksLikeDarkDisplay(image: Buffer, box: PixelBox) {
  try {
    const { channels } = await sharp(image, { failOn: "none" })
      .extract({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      })
      .resize(48, 48, { fit: "fill" })
      .stats();
    const mean =
      (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
    const stdev =
      (channels[0].stdev + channels[1].stdev + channels[2].stdev) / 3;
    // Painel: fundo preto/cinza e dígitos claros. Placa BR é cinza/branca.
    if (mean < 50) return true;
    if (mean < 88 && stdev > 42) return true;
    return false;
  } catch {
    return false;
  }
}

async function applyBlurRegions(image: Buffer, boxes: PixelBox[]): Promise<Buffer> {
  if (boxes.length === 0) return image;

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const box of boxes) {
    if (box.width < 4 || box.height < 4) continue;
    if (await looksLikeDarkDisplay(image, box)) continue;

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
        Filters: {
          WordFilter: {
            MinConfidence: MIN_WORD_CONFIDENCE,
          },
        },
      }),
    );

    const detections = response.TextDetections ?? [];
    const pieces = piecesFromDetections(detections, width, height);

    if (looksLikeInstrumentCluster(pieces)) {
      console.info(
        "[blur-plates] foto parece painel de moto/carro — sem blur.",
      );
      return input;
    }

    const boxes = boxesFromPieces(pieces, width, height);
    const plateBoxes: PixelBox[] = [];
    for (const box of boxes) {
      if (await looksLikeDarkDisplay(bytes, box)) continue;
      plateBoxes.push(box);
    }

    if (plateBoxes.length === 0) {
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
      `[blur-plates] ${plateBoxes.length} região(ões) de placa detectada(s) — aplicando blur sutil.`,
    );

    return await applyBlurRegions(bytes, plateBoxes);
  } catch (error) {
    console.error("[blur-plates] falha no Rekognition/blur — upload segue:", error);
    return input;
  }
}
