import type {
  BoundingBox,
  RekognitionClient,
  TextDetection,
} from "@aws-sdk/client-rekognition";
import sharp from "sharp";

/** Folga curta depois de achar a placa — só a faixa, sem comer o para-choque. */
const PLATE_PAD_X = 0.12;
const PLATE_PAD_Y = 0.18;
/** DetectText via bytes aceita no máximo ~5 MB. */
const REKOGNITION_MAX_BYTES = 4.5 * 1024 * 1024;

const OLD_PLATE = /^[A-Z]{3}\d{4}$/;
const MERCOSUL_PLATE = /^[A-Z]{3}\d[A-Z]\d{2}$/;
/** Palavras soltas (cidade, HR-V) precisam de confiança alta. */
const MIN_WORD_CONFIDENCE = 80;
/**
 * Placa de frente, longe, costuma vir com ~55–70%. O filtro da API em 80
 * descartava a dianteira do HR-V e deixava só a traseira.
 */
const MIN_PLATE_TEXT_CONFIDENCE = 52;
const REKOGNITION_WORD_FILTER = 50;
const MIN_CAR_AREA_RATIO = 0.12;
const LICENSE_PLATE_LABEL = /license\s*plate|vehicle\s*registration\s*plate/i;
const MERCOSUL_UFS = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
]);
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
  "DOT",
  "SAE",
  "HEL",
  "VAL",
  "ART",
  "KOI",
  "BOS",
  "OSR",
  "PHI",
  "LUC",
  "HID",
  "XEN",
  "VOL",
  "CIB",
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

async function getRekognitionClient() {
  const { RekognitionClient } = await import("@aws-sdk/client-rekognition");
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
 * Placa BR (7), BR/BRASIL + placa, ou placa colada no estado.
 * Janela só em texto curto já “limpo” — "ABS 1234 km/h" não vira placa.
 */
export function extractPlateCandidate(text: string | undefined) {
  if (!text) return null;
  const compact = compactAlphanumeric(text);
  if (!compact) return null;

  let value = compact;
  if (value.startsWith("BRASIL")) value = value.slice(6);
  else if (value.startsWith("BR") && value.length >= 9) value = value.slice(2);
  if (value.endsWith("BRASIL")) value = value.slice(0, -6);

  if (value.length >= 9 && MERCOSUL_UFS.has(value.slice(0, 2))) {
    value = value.slice(2);
  }
  if (value.length >= 9 && MERCOSUL_UFS.has(value.slice(-2))) {
    value = value.slice(0, -2);
  }

  if (isActualPlate(value)) return value;

  if (value.length >= 8 && value.length <= 12) {
    for (let index = 0; index <= value.length - 7; index += 1) {
      const slice = value.slice(index, index + 7);
      if (isActualPlate(slice)) return slice;
    }
  }
  return null;
}

export function textLooksLikePlate(text: string | undefined) {
  return extractPlateCandidate(text) !== null;
}

/**
 * Placa preta promocional de loja (ex.: Forte Automóveis no para-choque).
 * Lista curta e explícita — não casa “forte” no meio de outra palavra.
 */
const DEALER_PLATE_BRANDS = ["FORTE", "FORTEAUTOMOVEIS", "FORTEAUTO"] as const;
const DEALER_PLATE_WORDS = new Set(["FORTE", "AUTOMOVEIS"]);
const DEALER_PAD_X = 0.4;
const DEALER_PAD_Y_TOP = 0.35;
const DEALER_PAD_Y_BOTTOM = 0.8;
const DEALER_EXTRA_LEFT = 0.42;
const DEALER_DARK_LUMA = 68;
const DEALER_LETTER_GAP = 56;

function foldLatinUpper(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
}

function compactDealerText(text: string) {
  return foldLatinUpper(text).replace(/[^A-Z0-9]/g, "").replace(/0/g, "O");
}

function dealerWordsFrom(text: string) {
  return foldLatinUpper(text)
    .replace(/0/g, "O")
    .split(/[^A-Z]+/)
    .filter((part) => part.length >= 4);
}

export function textLooksLikeDealerPlate(text: string | undefined) {
  if (!text) return false;
  const compact = compactDealerText(text);
  if (!compact) return false;
  for (let index = 0; index < DEALER_PLATE_BRANDS.length; index += 1) {
    if (compact === DEALER_PLATE_BRANDS[index]) return true;
  }
  const words = dealerWordsFrom(text);
  for (let index = 0; index < words.length; index += 1) {
    if (DEALER_PLATE_WORDS.has(words[index])) return true;
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
  const padX = Math.max(4, Math.round(box.width * PLATE_PAD_X));
  const padY = Math.max(5, Math.round(box.height * PLATE_PAD_Y));
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
  if (box.width > imageWidth * 0.32) return false;
  if (box.height > imageHeight * 0.12) return false;
  // Placas são retangulares horizontais: moto ~1.18, carro ~3.08. Rejeita verticais e quadradas.
  if (aspect < 1.15) return false;
  if (aspect > 5.5) return false;
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

/** Marca no grade (HONDA) não conta — senão a foto da frente inteira é pulada. */
export function textsLookLikeDashboard(texts: string[]) {
  return looksLikeInstrumentCluster(
    texts.map((text) => ({
      text,
      box: { left: 0, top: 0, width: 12, height: 12 },
      type: "WORD",
      confidence: 99,
    })),
  );
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
    if (item.Type === "WORD") {
      if (confidence < MIN_PLATE_TEXT_CONFIDENCE) continue;
      if (
        confidence < MIN_WORD_CONFIDENCE &&
        !textLooksLikePlate(text) &&
        !textLooksLikeDealerPlate(text)
      ) {
        continue;
      }
    }
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
  const lines = pieces.filter(
    (piece) => piece.type === "LINE" && !isDashboardToken(piece.text),
  );

  for (const line of lines) {
    if (isTightPlateText(line.text)) addBox(line.box);
  }

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

export function plateBoxesFromText(
  pieces: TextPiece[],
  imageWidth: number,
  imageHeight: number,
) {
  return boxesFromPieces(pieces, imageWidth, imageHeight);
}

function isPlausibleDealerBox(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
) {
  if (box.width < 12 || box.height < 6) return false;
  const areaRatio = boxArea(box) / (imageWidth * imageHeight);
  if (areaRatio > 0.08) return false;
  if (box.width > imageWidth * 0.4) return false;
  if (box.height > imageHeight * 0.18) return false;
  return true;
}

function padDealerBox(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox {
  const padX = Math.max(8, Math.round(box.width * DEALER_PAD_X));
  const padTop = Math.max(4, Math.round(box.height * DEALER_PAD_Y_TOP));
  const padBottom = Math.max(8, Math.round(box.height * DEALER_PAD_Y_BOTTOM));
  const extraLeft = Math.max(10, Math.round(box.width * DEALER_EXTRA_LEFT));
  const left = Math.max(0, box.left - padX - extraLeft);
  const top = Math.max(0, box.top - padTop);
  const right = Math.min(imageWidth, box.left + box.width + padX);
  const bottom = Math.min(imageHeight, box.top + box.height + padBottom);
  return { left, top, width: right - left, height: bottom - top };
}

function mergeUnionBoxes(boxes: PixelBox[]): PixelBox[] {
  if (boxes.length <= 1) return boxes;

  const sorted = [...boxes].sort(
    (a, b) => a.left - b.left || a.top - b.top || boxArea(a) - boxArea(b),
  );
  const merged: PixelBox[] = [];

  for (const box of sorted) {
    const overlapIndex = merged.findIndex((item) => boxesOverlap(item, box));
    if (overlapIndex === -1) {
      merged.push({ ...box });
      continue;
    }
    merged[overlapIndex] = unionBox([merged[overlapIndex], box]);
  }

  return merged;
}

function dealerBoxesFromPieces(
  pieces: TextPiece[],
  imageWidth: number,
  imageHeight: number,
): PixelBox[] {
  const hits = pieces.filter((piece) => textLooksLikeDealerPlate(piece.text));
  if (hits.length === 0) return [];

  const boxes: PixelBox[] = [];
  const used = new Set<number>();

  for (let i = 0; i < hits.length; i += 1) {
    if (used.has(i)) continue;
    const group = [hits[i]];
    used.add(i);
    for (let j = i + 1; j < hits.length; j += 1) {
      if (used.has(j)) continue;
      if (group.some((item) => areNearby(item.box, hits[j].box))) {
        group.push(hits[j]);
        used.add(j);
      }
    }
    const united = unionBox(group.map((item) => item.box));
    if (!isPlausibleDealerBox(united, imageWidth, imageHeight)) continue;
    boxes.push(padDealerBox(united, imageWidth, imageHeight));
  }

  return mergeUnionBoxes(boxes);
}

export function dealerPlateBoxesFromText(
  pieces: TextPiece[],
  imageWidth: number,
  imageHeight: number,
) {
  return dealerBoxesFromPieces(pieces, imageWidth, imageHeight);
}

type DealerRun = { left: number; right: number; y: number };

function mergeRowRuns(runs: DealerRun[], gap: number): DealerRun[] {
  if (runs.length <= 1) return runs;
  const sorted = [...runs].sort((a, b) => a.left - b.left);
  const merged: DealerRun[] = [{ ...sorted[0] }];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const prev = merged[merged.length - 1];
    if (current.left - prev.right - 1 <= gap) {
      prev.right = Math.max(prev.right, current.right);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function darkRunsOnRow(
  luma: Float32Array,
  width: number,
  y: number,
  minW: number,
  maxW: number,
): DealerRun[] {
  const raw: DealerRun[] = [];
  let start = -1;
  const row = y * width;
  for (let x = 0; x < width; x += 1) {
    if (luma[row + x] < DEALER_DARK_LUMA) {
      if (start < 0) start = x;
    } else if (start >= 0) {
      raw.push({ left: start, right: x - 1, y });
      start = -1;
    }
  }
  if (start >= 0) raw.push({ left: start, right: width - 1, y });

  const merged = mergeRowRuns(raw, DEALER_LETTER_GAP);
  return merged.filter((run) => {
    const runW = run.right - run.left + 1;
    return runW >= minW && runW <= maxW;
  });
}

function clusterDealerRuns(runs: DealerRun[]): DealerRun[][] {
  if (runs.length === 0) return [];
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.left - b.left);
  const clusters: DealerRun[][] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const run = sorted[index];
    let placed = false;
    for (let c = 0; c < clusters.length; c += 1) {
      const cluster = clusters[c];
      const last = cluster[cluster.length - 1];
      const gapY = run.y - last.y;
      if (gapY < 0 || gapY > 3) continue;
      const overlap =
        Math.min(run.right, last.right) - Math.max(run.left, last.left) + 1;
      const minW = Math.min(run.right - run.left + 1, last.right - last.left + 1);
      if (overlap >= minW * 0.35) {
        const currentLeft = Math.min(...cluster.map((item) => item.left));
        const currentRight = Math.max(...cluster.map((item) => item.right));
        const currentW = currentRight - currentLeft + 1;
        const nextW =
          Math.max(currentRight, run.right) - Math.min(currentLeft, run.left) + 1;
        if (currentW >= 40 && nextW > currentW * 1.4) {
          continue;
        }
        cluster.push(run);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([run]);
  }

  return clusters;
}

function scoreBlackDealerPlate(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  box: PixelBox,
): number {
  if (box.width < 28 || box.height < 16) return 0;
  const aspect = box.width / box.height;
  if (aspect < 1.85 || aspect > 6.0) return 0;
  if (box.left < 0 || box.top < 0) return 0;
  if (box.left + box.width > width || box.top + box.height > height) return 0;

  let dark = 0;
  let black = 0;
  let light = 0;
  let white = 0;
  let blueish = 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = box.top; y < box.top + box.height; y += 1) {
    for (let x = box.left; x < box.left + box.width; x += 1) {
      const offset = (y * width + x) * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += luma;
      sumSq += luma * luma;
      count += 1;
      if (luma < DEALER_DARK_LUMA) dark += 1;
      if (luma < 48) black += 1;
      if (luma > 165) light += 1;
      if (luma > 200) white += 1;
      if (isMercosulBlue(r, g, b)) blueish += 1;
    }
  }
  if (count === 0) return 0;

  const darkRatio = dark / count;
  const blackRatio = black / count;
  const lightRatio = light / count;
  const whiteRatio = white / count;
  const blueRatio = blueish / count;
  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  const stdev = Math.sqrt(variance);

  // Placa Mercosul é branca; faixa azul sozinha não tem texto branco suficiente
  // no mesmo retângulo escuro. Placa preta da loja é bimodal (preto + branco).
  if (darkRatio < 0.22 || darkRatio > 0.88) return 0;
  if (blackRatio < 0.2) return 0;
  if (lightRatio < 0.08 || whiteRatio < 0.1) return 0;
  if (blueRatio > 0.14) return 0;
  if (stdev < 28) return 0;

  let ring = 0;
  let ringCount = 0;
  const pad = 3;
  for (let y = Math.max(0, box.top - pad); y < Math.min(height, box.top + box.height + pad); y += 1) {
    for (let x = Math.max(0, box.left - pad); x < Math.min(width, box.left + box.width + pad); x += 1) {
      const inside =
        x >= box.left &&
        x < box.left + box.width &&
        y >= box.top &&
        y < box.top + box.height;
      if (inside) continue;
      const offset = (y * width + x) * channels;
      ring += 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
      ringCount += 1;
    }
  }
  if (ringCount > 0) {
    const ringMean = ring / ringCount;
    // Isolada no para-choque claro — rejeita grade/pneu/saia preta.
    if (ringMean < mean + 28) return 0;
  }

  return stdev * (0.35 + lightRatio) * (0.4 + darkRatio);
}

/**
 * Acha retângulos pretos de placa promocional (fundo escuro + texto claro)
 * numa região — caminho extra, independente da faixa azul Mercosul.
 */
export async function findBlackDealerPlateBoxes(
  image: Buffer,
  region: PixelBox,
): Promise<PixelBox[]> {
  let data: Buffer;
  let width = 0;
  let height = 0;
  let channels = 0;
  try {
    const extracted = await sharp(image, { failOn: "none" })
      .extract({
        left: region.left,
        top: region.top,
        width: region.width,
        height: region.height,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = extracted.data;
    width = extracted.info.width;
    height = extracted.info.height;
    channels = extracted.info.channels;
  } catch {
    return [];
  }

  const luma = new Float32Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * channels;
    luma[index] =
      0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
  }

  // Largura de placa, não de saia/grade. Ombros claros por linha falham na
  // Forte em 3/4 (letras brancas grandes) — o score do retângulo filtra.
  const minW = Math.max(24, Math.round(width * 0.03));
  const maxW = Math.max(110, Math.min(210, Math.round(width * 0.32)));
  const runs: DealerRun[] = [];
  for (let y = 0; y < height; y += 1) {
    const rowRuns = darkRunsOnRow(luma, width, y, minW, maxW);
    runs.push(...rowRuns);
  }

  const clusters = clusterDealerRuns(runs);
  const boxes: PixelBox[] = [];
  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = clusters[index];
    if (cluster.length < 6) continue;
    const left = Math.min(...cluster.map((run) => run.left));
    const right = Math.max(...cluster.map((run) => run.right));
    const top = cluster[0].y;
    const bottom = cluster[cluster.length - 1].y;
    const local: PixelBox = {
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1,
    };
    if (scoreBlackDealerPlate(data, width, height, channels, local) <= 0) {
      continue;
    }
    boxes.push({
      left: region.left + local.left,
      top: region.top + local.top,
      width: local.width,
      height: local.height,
    });
  }

  return mergeUnionBoxes(boxes);
}

function regionAroundBox(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox {
  const width = Math.min(imageWidth, Math.max(96, Math.round(box.width * 3.2)));
  const height = Math.min(imageHeight, Math.max(56, Math.round(box.height * 3.2)));
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const left = Math.max(0, Math.round(cx - width / 2));
  const top = Math.max(0, Math.round(cy - height / 2));
  return {
    left: Math.min(left, Math.max(0, imageWidth - width)),
    top: Math.min(top, Math.max(0, imageHeight - height)),
    width: Math.min(width, imageWidth - Math.min(left, imageWidth - width)),
    height: Math.min(height, imageHeight - Math.min(top, imageHeight - height)),
  };
}

export async function dealerBoxesFromImage(
  image: Buffer,
  pieces: TextPiece[],
  imageWidth: number,
  imageHeight: number,
): Promise<PixelBox[]> {
  const fromText = dealerBoxesFromPieces(pieces, imageWidth, imageHeight);
  // Só expande em volta do texto da loja. Varredura larga pega farol/pneu.
  const regions: PixelBox[] = [];
  for (let index = 0; index < fromText.length; index += 1) {
    regions.push(regionAroundBox(fromText[index], imageWidth, imageHeight));
  }

  const visual: PixelBox[] = [];
  for (let index = 0; index < regions.length; index += 1) {
    const found = await findBlackDealerPlateBoxes(image, regions[index]);
    visual.push(...found);
  }

  const paddedVisual = visual
    .filter((box) => isPlausibleDealerBox(box, imageWidth, imageHeight))
    .map((box) => padDealerBox(box, imageWidth, imageHeight));

  return mergeUnionBoxes([...fromText, ...paddedVisual]);
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

function bumperSearchRegion(
  car: PixelBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox | null {
  // A placa dianteira/traseira fica na faixa central do para-choque.
  // Evita o terço superior (faróis/grade) e as extremidades laterais (milhas/rodas).
  const top = Math.max(0, car.top + Math.round(car.height * 0.46));
  const bottom = Math.min(
    imageHeight,
    car.top + car.height + Math.round(car.height * 0.04),
  );
  const left = Math.max(0, car.left + Math.round(car.width * 0.16));
  const right = Math.min(
    imageWidth,
    car.left + Math.round(car.width * 0.84),
  );
  const width = right - left;
  const height = bottom - top;
  if (width < 24 || height < 16) return null;
  return { left, top, width, height };
}

function isMercosulBlue(r: number, g: number, b: number) {
  // Azul Mercosul oficial (Pantone 286C / #003399):
  // Azul forte e saturado. Rejeita reflexos cinza, faróis xenon e céu refletido.
  return (
    b >= 75 &&
    b <= 215 &&
    b - r >= 24 &&
    b - g >= 14 &&
    r <= 115 &&
    g <= 130
  );
}

function hasLightPlateBodyBelow(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  blob: BlueBlob,
): boolean {
  // Placa Mercosul possui corpo branco/cinza claro abaixo da faixa azul.
  // Faróis e grades pretas têm plástico escuro ou lâmpada.
  const startY = blob.top + blob.height;
  const sampleHeight = Math.min(Math.max(4, Math.round(blob.height * 1.2)), height - startY);
  if (sampleHeight < 3) return true;

  let totalLuma = 0;
  let sampleCount = 0;
  const startX = Math.round(blob.left + blob.width * 0.15);
  const endX = Math.round(blob.left + blob.width * 0.85);

  for (let y = startY; y < startY + sampleHeight; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = (y * width + x) * channels;
      const luma = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
      totalLuma += luma;
      sampleCount += 1;
    }
  }

  if (sampleCount === 0) return true;
  const avgLuma = totalLuma / sampleCount;
  return avgLuma >= 65;
}

type BlueBlob = PixelBox & { pixels: number };

function connectedBlueBlobs(
  mask: Uint8Array,
  width: number,
  height: number,
): BlueBlob[] {
  const seen = new Uint8Array(width * height);
  const blobs: BlueBlob[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!mask[start] || seen[start]) continue;

      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let pixels = 0;
      const stack = [start];
      seen[start] = 1;

      while (stack.length > 0) {
        const current = stack.pop() as number;
        const cx = current % width;
        const cy = (current - cx) / width;
        pixels += 1;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const neighbors = [
          [cx - 1, cy],
          [cx + 1, cy],
          [cx, cy - 1],
          [cx, cy + 1],
        ];
        for (let index = 0; index < neighbors.length; index += 1) {
          const nx = neighbors[index][0];
          const ny = neighbors[index][1];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (seen[next] || !mask[next]) continue;
          seen[next] = 1;
          stack.push(next);
        }
      }

      blobs.push({
        left: minX,
        top: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        pixels,
      });
    }
  }

  return blobs;
}

function plateBoxFromBlueBlob(
  blob: BlueBlob,
  regionWidth: number,
  regionHeight: number,
): PixelBox | null {
  if (blob.pixels < 8) return null;
  if (blob.width < 10 || blob.height < 2) return null;
  if (blob.width > regionWidth * 0.45 || blob.height > regionHeight * 0.45) {
    return null;
  }
  const aspect = blob.width / Math.max(1, blob.height);
  if (aspect < 1.15 || aspect > 14) return null;

  if (
    aspect <= 4.8 &&
    blob.height >= 10 &&
    blob.width >= 18 &&
    blob.height <= blob.width * 0.85
  ) {
    let height = blob.height;
    // 3/4: o azul pega só o topo; a placa inteira é mais alta.
    if (aspect < 1.75) {
      height = Math.max(height + 10, Math.round(blob.width * 1.25));
    }
    height = Math.min(regionHeight - blob.top, height);
    return { left: blob.left, top: blob.top, width: blob.width, height };
  }

  if (blob.height <= blob.width * 0.55) {
    const plateH = Math.max(
      blob.height + 8,
      Math.min(Math.round(blob.width / 2.4), Math.round(blob.width * 0.9)),
    );
    const height = Math.min(regionHeight - blob.top, plateH);
    if (height < 8) return null;
    return { left: blob.left, top: blob.top, width: blob.width, height };
  }

  return null;
}

export async function findMercosulStripeBoxes(
  image: Buffer,
  region: PixelBox,
): Promise<PixelBox[]> {
  let data: Buffer;
  let width = 0;
  let height = 0;
  let channels = 0;
  try {
    const extracted = await sharp(image, { failOn: "none" })
      .extract({
        left: region.left,
        top: region.top,
        width: region.width,
        height: region.height,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = extracted.data;
    width = extracted.info.width;
    height = extracted.info.height;
    channels = extracted.info.channels;
  } catch {
    return [];
  }
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * channels;
    if (isMercosulBlue(data[offset], data[offset + 1], data[offset + 2])) {
      mask[index] = 1;
    }
  }

  const boxes: PixelBox[] = [];
  const blobs = connectedBlueBlobs(mask, width, height);
  for (let index = 0; index < blobs.length; index += 1) {
    const blob = blobs[index];
    if (!hasLightPlateBodyBelow(data, width, height, channels, blob)) continue;
    const shaped = plateBoxFromBlueBlob(blob, width, height);
    if (!shaped) continue;
    // Cromado no corte do para-choque vira blob no topo da região.
    if (shaped.top <= 2 && shaped.height < 22) continue;
    if (shaped.width < 22 || shaped.height < 12) continue;
    if (shaped.width * shaped.height < 360) continue;
    boxes.push({
      left: region.left + shaped.left,
      top: region.top + shaped.top,
      width: shaped.width,
      height: shaped.height,
    });
  }
  return boxes;
}

async function detectVehicleLabels(
  client: RekognitionClient,
  bytes: Buffer,
  imageWidth: number,
  imageHeight: number,
) {
  const cars: PixelBox[] = [];
  const plates: PixelBox[] = [];
  try {
    const { DetectLabelsCommand } = await import("@aws-sdk/client-rekognition");
    const response = await client.send(
      new DetectLabelsCommand({
        Image: { Bytes: bytes },
        MaxLabels: 30,
        MinConfidence: 55,
      }),
    );
    const labels = response.Labels ?? [];
    for (let index = 0; index < labels.length; index += 1) {
      const label = labels[index];
      const name = label.Name ?? "";
      const isPlate = LICENSE_PLATE_LABEL.test(name);
      const isCar =
        /^(car|automobile|vehicle|suv|truck|pickup truck|van)$/i.test(name);
      if (!isPlate && !isCar) continue;
      const instances = label.Instances ?? [];
      for (let instIndex = 0; instIndex < instances.length; instIndex += 1) {
        const instance = instances[instIndex];
        if ((instance.Confidence ?? 0) < 55) continue;
        const geometry = instance.BoundingBox;
        if (!geometry) continue;
        const box = boxToPixels(geometry, imageWidth, imageHeight);
        if (!box) continue;
        if (isPlate) plates.push(box);
        if (isCar && boxArea(box) / (imageWidth * imageHeight) >= MIN_CAR_AREA_RATIO) {
          cars.push(box);
        }
      }
    }
  } catch (error) {
    console.warn("[blur-plates] DetectLabels falhou — segue só o texto:", error);
  }
  return { cars, plates };
}

function acceptFoundBox(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox | null {
  if (!isPlausiblePlateBox(box, imageWidth, imageHeight)) return null;
  if (isPlateShaped(box, imageWidth, imageHeight)) {
    return padBox(box, imageWidth, imageHeight);
  }
  const clamped = clampToPlateShape(box, imageWidth, imageHeight);
  if (!isPlateShaped(clamped, imageWidth, imageHeight)) return null;
  return padBox(clamped, imageWidth, imageHeight);
}

async function findPlatesWithoutReadableText(
  client: RekognitionClient,
  bytes: Buffer,
  imageWidth: number,
  imageHeight: number,
): Promise<PixelBox[]> {
  const labels = await detectVehicleLabels(client, bytes, imageWidth, imageHeight);
  const boxes: PixelBox[] = [];

  for (let index = 0; index < labels.plates.length; index += 1) {
    const accepted = acceptFoundBox(labels.plates[index], imageWidth, imageHeight);
    if (accepted) boxes.push(accepted);
  }
  if (boxes.length > 0) {
    const filtered = disambiguateCarPlates(
      boxes,
      labels.cars,
      imageWidth,
      imageHeight,
    );
    return mergeOverlappingBoxes(filtered);
  }

  for (let index = 0; index < labels.cars.length; index += 1) {
    const region = bumperSearchRegion(labels.cars[index], imageWidth, imageHeight);
    if (!region) continue;
    const found = await findMercosulStripeBoxes(bytes, region);
    for (let boxIndex = 0; boxIndex < found.length; boxIndex += 1) {
      const accepted = acceptFoundBox(found[boxIndex], imageWidth, imageHeight);
      if (accepted) boxes.push(accepted);
    }
  }

  const filtered = disambiguateCarPlates(
    boxes,
    labels.cars,
    imageWidth,
    imageHeight,
  );
  return mergeOverlappingBoxes(filtered);
}

export function isHeadlightOrCornerZone(
  box: PixelBox,
  car: PixelBox | null,
  imageWidth: number,
  imageHeight: number,
): boolean {
  const reference = car ?? { left: 0, top: 0, width: imageWidth, height: imageHeight };
  const relLeft = (box.left - reference.left) / reference.width;
  const relRight = (box.left + box.width - reference.left) / reference.width;
  const relTop = (box.top - reference.top) / reference.height;
  const relCenterY = (box.top + box.height / 2 - reference.top) / reference.height;

  // 1. Faróis dianteiros / lanternas superiores:
  // Terço superior/médio nas laterais (esquerda < 0.28 ou direita > 0.72, topo < 0.58)
  const isFarLeft = relRight < 0.28;
  const isFarRight = relLeft > 0.72;
  if ((isFarLeft || isFarRight) && relTop < 0.58) {
    return true;
  }

  // 2. Extremidades externas do para-choque (milhas, caixas de roda, pneus)
  // As placas no Brasil ficam na faixa central do para-choque (entre 0.16 e 0.84)
  if (relRight < 0.16 || relLeft > 0.84) {
    return true;
  }

  // 3. Capô / topo do veículo (nunca há placa no terço superior)
  if (relCenterY < 0.35) {
    return true;
  }

  return false;
}

export function disambiguateCarPlates(
  boxes: PixelBox[],
  cars: PixelBox[],
  imageWidth: number,
  imageHeight: number,
): PixelBox[] {
  if (boxes.length === 0) return [];

  const validBoxes: PixelBox[] = [];
  for (const box of boxes) {
    const parentCar = cars.find((c) => boxesOverlap(c, box)) ?? null;
    if (isHeadlightOrCornerZone(box, parentCar, imageWidth, imageHeight)) {
      continue;
    }
    validBoxes.push(box);
  }

  if (validBoxes.length <= 1) return validBoxes;

  // Se há carros detectados, agrupa por carro para permitir no máximo 1 placa por veículo
  if (cars.length > 0) {
    const result: PixelBox[] = [];
    for (const car of cars) {
      const carBoxes = validBoxes.filter((b) => boxesOverlap(car, b));
      if (carBoxes.length === 1) {
        result.push(carBoxes[0]);
      } else if (carBoxes.length > 1) {
        // Escolhe o box mais centralizado no carro horizontalmente
        const carCenterX = car.left + car.width / 2;
        const sorted = [...carBoxes].sort((a, b) => {
          const aDist = Math.abs(a.left + a.width / 2 - carCenterX) / car.width;
          const bDist = Math.abs(b.left + b.width / 2 - carCenterX) / car.width;
          return aDist - bDist;
        });
        result.push(sorted[0]);
      }
    }
    const orphans = validBoxes.filter(
      (b) => !cars.some((c) => boxesOverlap(c, b)),
    );
    if (orphans.length > 0) {
      result.push(...orphans);
    }
    return result;
  }

  // Sem carro explícito: escolhe a placa mais centralizada horizontalmente na imagem
  const imgCenterX = imageWidth / 2;
  const sorted = [...validBoxes].sort((a, b) => {
    const aDist = Math.abs(a.left + a.width / 2 - imgCenterX) / imageWidth;
    const bDist = Math.abs(b.left + b.width / 2 - imgCenterX) / imageWidth;
    return aDist - bDist;
  });
  return [sorted[0]];
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

type BlurBox = PixelBox & { allowDark?: boolean };

export async function applyBlurRegions(
  image: Buffer,
  boxes: BlurBox[],
): Promise<Buffer> {
  if (boxes.length === 0) return image;

  const composites: { input: Buffer; left: number; top: number }[] = [];

  for (const box of boxes) {
    if (box.width < 4 || box.height < 4) continue;
    if (!box.allowDark && (await looksLikeDarkDisplay(image, box))) continue;

    const shortSide = Math.min(box.width, box.height);
    const smallPlate = shortSide < 40;
    const sigma = Math.min(
      16,
      Math.max(smallPlate ? 8 : 5, Math.round(shortSide / (smallPlate ? 4 : 6))),
    );
    const radius = Math.max(2, Math.round(shortSide * (smallPlate ? 0.12 : 0.2)));
    const feather = smallPlate ? 0.7 : Math.max(1.2, shortSide * 0.07);
    const inset = smallPlate ? 0 : Math.max(1, Math.round(feather));
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
 * Também borra placa preta promocional de loja (Forte Automóveis), sem
 * alterar o caminho da Mercosul.
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

    const client = await getRekognitionClient();
    const { DetectTextCommand } = await import("@aws-sdk/client-rekognition");
    const response = await client.send(
      new DetectTextCommand({
        Image: { Bytes: bytes },
        Filters: {
          WordFilter: {
            MinConfidence: REKOGNITION_WORD_FILTER,
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

    let boxes = boxesFromPieces(pieces, width, height);
    if (boxes.length > 0) {
      boxes = disambiguateCarPlates(boxes, [], width, height);
    }
    if (boxes.length === 0) {
      boxes = await findPlatesWithoutReadableText(client, bytes, width, height);
    }

    const plateBoxes: PixelBox[] = [];
    for (const box of boxes) {
      if (await looksLikeDarkDisplay(bytes, box)) continue;
      plateBoxes.push(box);
    }

    const dealerBoxes = await dealerBoxesFromImage(bytes, pieces, width, height);

    const blurBoxes: BlurBox[] = [
      ...plateBoxes.map((box) => ({ ...box, allowDark: false })),
      ...dealerBoxes.map((box) => ({ ...box, allowDark: true })),
    ];

    if (blurBoxes.length === 0) {
      console.warn("[blur-plates] nenhuma placa reconhecida.");
      return input;
    }

    console.info(
      `[blur-plates] ${plateBoxes.length} placa(s) + ${dealerBoxes.length} placa(s) de loja — aplicando blur.`,
    );

    return await applyBlurRegions(bytes, blurBoxes);
  } catch (error) {
    console.error("[blur-plates] falha no Rekognition/blur — upload segue:", error);
    return input;
  }
}
