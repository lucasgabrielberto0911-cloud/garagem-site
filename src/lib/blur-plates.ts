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
  "PGMFI",
  "PGM",
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
  "PGM",
  "PGMFI",
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
/** Padding curto: a caixa visual + OCR já cobrem logo e AUTOMÓVEIS. */
const DEALER_PAD_X = 0.16;
const DEALER_PAD_Y_TOP = 0.2;
const DEALER_PAD_Y_BOTTOM = 0.45;
const DEALER_EXTRA_LEFT = 0.28;
const DEALER_TIGHT_PAD_X = 0.08;
const DEALER_TIGHT_PAD_Y_TOP = 0.12;
const DEALER_TIGHT_PAD_Y_BOTTOM = 0.18;
const DEALER_DARK_LUMA = 68;
const DEALER_LETTER_GAP = 56;
/** Palavra de loja com confiança baixa é reflexo/OCR solto — não é FORTE. */
const DEALER_MIN_WORD_CONFIDENCE = 68;
/** Letras claras no miolo — para-choque/farol não têm isso. */
const DEALER_MIN_INSET_LIGHT = 0.08;

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

function isPrimaryDealerBrand(text: string) {
  const compact = compactDealerText(text);
  if (!compact) return false;
  for (let index = 0; index < DEALER_PLATE_BRANDS.length; index += 1) {
    if (compact === DEALER_PLATE_BRANDS[index]) return true;
  }
  return false;
}

function isTightPlateText(text: string) {
  return textLooksLikePlate(text);
}

/** Portinhola, calota e emblema: quase quadrado/círculo, não placa de carro.
 *  Placa de moto Mercosul (~1.18) cai nesta faixa — o desempate é a faixa azul.
 */
export function isUnlikelyPlateGeometry(box: PixelBox) {
  const aspect = box.width / Math.max(1, box.height);
  return aspect >= 0.72 && aspect <= 1.28;
}

function overlapArea(a: PixelBox, b: PixelBox) {
  const width = Math.max(
    0,
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left),
  );
  const height = Math.max(
    0,
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top),
  );
  return width * height;
}

function boxContainsCenter(box: PixelBox, inner: PixelBox) {
  const x = inner.left + inner.width / 2;
  const y = inner.top + inner.height / 2;
  return (
    x >= box.left &&
    x < box.left + box.width &&
    y >= box.top &&
    y < box.top + box.height
  );
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
  const aspect = box.width / Math.max(1, box.height);
  const compact = aspect <= 1.65;
  const padX = Math.max(
    compact ? 2 : 4,
    Math.round(box.width * (compact ? 0.08 : PLATE_PAD_X)),
  );
  const padY = Math.max(
    compact ? 2 : 5,
    Math.round(box.height * (compact ? 0.08 : PLATE_PAD_Y)),
  );
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

function isMotorcyclePlateShaped(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
) {
  const aspect = box.width / Math.max(1, box.height);
  // Oficial ~200×170mm (aspecto ~1.18). Em 3/4 a placa fica mais alta que larga.
  if (aspect < 0.62 || aspect > 2.15) return false;
  if (box.width < 16 || box.height < 12) return false;
  if (box.width > imageWidth * 0.22) return false;
  if (box.height > imageHeight * 0.28) return false;
  const areaRatio = boxArea(box) / (imageWidth * imageHeight);
  if (areaRatio > 0.05 || areaRatio < 0.0015) return false;
  return true;
}

function isPlateShaped(box: PixelBox, imageWidth: number, imageHeight: number) {
  if (box.width < 14 || box.height < 8) return false;
  const aspect = box.width / Math.max(1, box.height);
  const areaRatio = boxArea(box) / (imageWidth * imageHeight);
  if (areaRatio > 0.05) return false;
  if (box.width > imageWidth * 0.32) return false;
  if (aspect >= 1.15 && aspect <= 5.5) {
    if (box.height <= imageHeight * 0.18) return true;
    // Placa de moto (duas linhas) é mais alta que a faixa de carro.
    return aspect <= 2.15 && isMotorcyclePlateShaped(box, imageWidth, imageHeight);
  }
  return isMotorcyclePlateShaped(box, imageWidth, imageHeight);
}

/** Caixa crua grande demais (display do painel) não é placa — nem recortando. */
function isPlausiblePlateBox(box: PixelBox, imageWidth: number, imageHeight: number) {
  const aspect = box.width / Math.max(1, box.height);
  const areaRatio = boxArea(box) / (imageWidth * imageHeight);
  if (areaRatio > 0.055) return false;
  if (box.width > imageWidth * 0.32) return false;
  const maxHeightRatio = aspect < 1.4 ? 0.3 : 0.18;
  if (box.height > imageHeight * maxHeightRatio) return false;
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
  const sourceAspect = box.width / Math.max(1, box.height);
  // Moto Mercosul (~1:1) e portinhola: não esmaga em faixa de carro.
  // A 2ª linha da placa de moto (SGD / 9E87) sumiria no recorte.
  if (sourceAspect >= 0.62 && sourceAspect <= 1.4) {
    return box;
  }

  const maxW = Math.max(24, Math.round(imageWidth * 0.2));
  const maxH = Math.max(
    14,
    Math.round(imageHeight * (sourceAspect <= 2.6 ? 0.14 : 0.085)),
  );
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
    if (textLooksLikeDealerPlate(text) && confidence < DEALER_MIN_WORD_CONFIDENCE) {
      continue;
    }
    if (item.Type === "WORD") {
      if (confidence < MIN_PLATE_TEXT_CONFIDENCE) continue;
      if (
        confidence < MIN_WORD_CONFIDENCE &&
        !textLooksLikePlate(text) &&
        !isDashboardToken(text)
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
    padBox(expandWithPlateHeaders(box, pieces), imageWidth, imageHeight),
  );
}

function isPlateHeaderToken(text: string) {
  const compact = normalizeToken(text);
  if (!compact) return false;
  return compact === "BRASIL" || compact === "BR" || MERCOSUL_UFS.has(compact);
}

/** Inclui a faixa BRASIL acima da placa de moto (duas linhas). */
function expandWithPlateHeaders(box: PixelBox, pieces: TextPiece[]): PixelBox {
  const extras: PixelBox[] = [box];
  for (const piece of pieces) {
    if (!isPlateHeaderToken(piece.text)) continue;
    const header = piece.box;
    const aligned =
      header.left < box.left + box.width &&
      header.left + header.width > box.left;
    const gap = box.top - (header.top + header.height);
    const justAbove =
      gap >= -header.height && gap <= Math.max(14, Math.round(box.height * 0.9));
    if ((aligned && justAbove) || boxesOverlap(header, box)) {
      extras.push(header);
    }
  }
  return extras.length === 1 ? box : unionBox(extras);
}

export function plateBoxesFromText(
  pieces: TextPiece[],
  imageWidth: number,
  imageHeight: number,
) {
  return boxesFromPieces(pieces, imageWidth, imageHeight);
}

function isPlausibleDealerOcrBox(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
) {
  if (box.width < 8 || box.height < 4) return false;
  const areaRatio = boxArea(box) / (imageWidth * imageHeight);
  if (areaRatio > 0.08) return false;
  if (box.width > imageWidth * 0.45) return false;
  if (box.height > imageHeight * 0.2) return false;
  return true;
}

function isPlausibleDealerBox(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
) {
  if (box.width < 12 || box.height < 6) return false;
  const aspect = box.width / Math.max(1, box.height);
  if (aspect < 1.45 || aspect > 7.2) return false;
  const areaRatio = boxArea(box) / (imageWidth * imageHeight);
  if (areaRatio > 0.09) return false;
  if (box.width > imageWidth * 0.38) return false;
  if (box.height > imageHeight * 0.18) return false;
  return true;
}

function padDealerBox(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox {
  const padX = Math.max(6, Math.round(box.width * DEALER_PAD_X));
  const padTop = Math.max(3, Math.round(box.height * DEALER_PAD_Y_TOP));
  const padBottom = Math.max(6, Math.round(box.height * DEALER_PAD_Y_BOTTOM));
  const extraLeft = Math.max(8, Math.round(box.width * DEALER_EXTRA_LEFT));
  const left = Math.max(0, box.left - padX - extraLeft);
  const top = Math.max(0, box.top - padTop);
  const right = Math.min(imageWidth, box.left + box.width + padX);
  const bottom = Math.min(imageHeight, box.top + box.height + padBottom);
  return { left, top, width: right - left, height: bottom - top };
}

/** Folga curta depois do retângulo preto + OCR — não pinta farol/saia. */
function padDealerBoxTight(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox {
  const padX = Math.max(3, Math.round(box.width * DEALER_TIGHT_PAD_X));
  const padTop = Math.max(2, Math.round(box.height * DEALER_TIGHT_PAD_Y_TOP));
  const padBottom = Math.max(3, Math.round(box.height * DEALER_TIGHT_PAD_Y_BOTTOM));
  const left = Math.max(0, box.left - padX);
  const top = Math.max(0, box.top - padTop);
  const right = Math.min(imageWidth, box.left + box.width + padX);
  const bottom = Math.min(imageHeight, box.top + box.height + padBottom);
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * O cluster escuro às vezes pega só a linha FORTE. Estica um pouco para baixo
 * até o aspecto ~3:1 da plaquinha, sem varrer o para-choque inteiro.
 */
function completeDealerVisual(
  box: PixelBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox {
  const aspect = box.width / Math.max(1, box.height);
  if (aspect <= 3.8) return box;
  const targetH = Math.min(
    imageHeight - box.top,
    Math.max(box.height, Math.round(box.width / 3.0)),
    Math.round(box.height * 2.2),
  );
  const height = Math.max(box.height, targetH);
  const width = Math.min(box.width, imageWidth - box.left);
  return { left: box.left, top: box.top, width, height };
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

type DealerOcrGroup = {
  box: PixelBox;
  hasForte: boolean;
};

function unpaddedDealerGroups(
  pieces: TextPiece[],
  imageWidth: number,
  imageHeight: number,
): DealerOcrGroup[] {
  const hits = pieces.filter((piece) => textLooksLikeDealerPlate(piece.text));
  if (hits.length === 0) return [];

  const groups: DealerOcrGroup[] = [];
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
    if (!isPlausibleDealerOcrBox(united, imageWidth, imageHeight)) continue;
    groups.push({
      box: united,
      hasForte: group.some((item) => isPrimaryDealerBrand(item.text)),
    });
  }

  return groups;
}

function dealerBoxesFromPieces(
  pieces: TextPiece[],
  imageWidth: number,
  imageHeight: number,
): PixelBox[] {
  return mergeUnionBoxes(
    unpaddedDealerGroups(pieces, imageWidth, imageHeight).map((group) =>
      padDealerBox(group.box, imageWidth, imageHeight),
    ),
  );
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

type PatchSignals = {
  aspect: number;
  mean: number;
  stdev: number;
  darkRatio: number;
  blackRatio: number;
  lightRatio: number;
  whiteRatio: number;
  coreDark: number;
  insetLight: number;
  topFringeLightShare: number;
};

function measureDealerPatch(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  box: PixelBox,
): PatchSignals | null {
  if (box.width < 8 || box.height < 8) return null;
  if (box.left < 0 || box.top < 0) return null;
  if (box.left + box.width > width || box.top + box.height > height) return null;

  const aspect = box.width / box.height;
  let dark = 0;
  let black = 0;
  let light = 0;
  let white = 0;
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  let coreDark = 0;
  let coreN = 0;
  let insetLight = 0;
  let insetN = 0;
  let topLight = 0;
  let lightCount = 0;
  const topEnd = box.top + Math.max(2, Math.round(box.height * 0.28));
  const insetX0 = box.left + Math.round(box.width * 0.12);
  const insetX1 = box.left + box.width - Math.round(box.width * 0.12);
  const insetY0 = box.top + Math.round(box.height * 0.18);
  const insetY1 = box.top + box.height - Math.round(box.height * 0.18);
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  for (let y = box.top; y < box.top + box.height; y += 1) {
    for (let x = box.left; x < box.left + box.width; x += 1) {
      const offset = (y * width + x) * channels;
      const luma =
        0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
      sum += luma;
      sumSq += luma * luma;
      count += 1;
      const isDark = luma < DEALER_DARK_LUMA;
      if (isDark) dark += 1;
      if (luma < 48) black += 1;
      if (luma > 165) {
        light += 1;
        lightCount += 1;
        if (y < topEnd) topLight += 1;
      }
      if (luma > 200) white += 1;

      const dx = (x - cx) / (box.width / 2);
      const dy = (y - cy) / (box.height / 2);
      if (Math.hypot(dx, dy) < 0.55) {
        coreN += 1;
        if (isDark) coreDark += 1;
      }
      if (x >= insetX0 && x < insetX1 && y >= insetY0 && y < insetY1) {
        insetN += 1;
        if (luma > 165) insetLight += 1;
      }
    }
  }
  if (count === 0) return null;

  const mean = sum / count;
  const stdev = Math.sqrt(Math.max(0, sumSq / count - mean * mean));
  return {
    aspect,
    mean,
    stdev,
    darkRatio: dark / count,
    blackRatio: black / count,
    lightRatio: light / count,
    whiteRatio: white / count,
    coreDark: coreDark / Math.max(1, coreN),
    insetLight: insetLight / Math.max(1, insetN),
    topFringeLightShare: lightCount ? topLight / lightCount : 0,
  };
}

/**
 * Portinhola, caixa de roda, friso e reflexo: escuro sólido ou tinta clara
 * sem “furos” de letra no miolo. Placa preta da loja tem texto claro interno.
 */
function looksLikeBodyPanelPatch(signals: PatchSignals): boolean {
  if (
    signals.aspect >= 0.72 &&
    signals.aspect <= 1.28 &&
    signals.mean > 150 &&
    signals.coreDark < 0.18
  ) {
    return true;
  }
  if (signals.mean > 170 && signals.darkRatio < 0.1 && signals.coreDark < 0.12) {
    return true;
  }
  if (signals.coreDark >= 0.78 && signals.insetLight < 0.12) return true;
  if (signals.topFringeLightShare >= 0.55 && signals.insetLight < 0.12) {
    return true;
  }
  // Para-choque, farol e smears: escuro sem “furos” de letra. A Forte tem
  // texto claro no miolo; sem isso não é plaquinha de loja.
  if (
    signals.insetLight < 0.05 &&
    signals.lightRatio < 0.05 &&
    signals.whiteRatio < 0.04
  ) {
    return true;
  }
  return false;
}

/**
 * Confirma placa preta de loja: fundo escuro + letras claras no miolo.
 * Recusa farol, saia e caixa cinza no para-choque.
 */
export async function looksLikeConfirmedDealerPlate(
  image: Buffer,
  box: PixelBox,
): Promise<boolean> {
  if (box.width < 16 || box.height < 8) return false;
  const aspect = box.width / box.height;
  if (aspect < 1.55 || aspect > 6.5) return false;
  try {
    const extracted = await sharp(image, { failOn: "none" })
      .extract({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const signals = measureDealerPatch(
      extracted.data,
      extracted.info.width,
      extracted.info.height,
      extracted.info.channels,
      {
        left: 0,
        top: 0,
        width: extracted.info.width,
        height: extracted.info.height,
      },
    );
    if (!signals) return false;
    if (looksLikeBodyPanelPatch(signals)) return false;
    if (signals.insetLight < DEALER_MIN_INSET_LIGHT && signals.lightRatio < 0.08) {
      return false;
    }
    if (signals.darkRatio < 0.18) return false;
    if (signals.whiteRatio < 0.04 && signals.lightRatio < 0.1) return false;
    return true;
  } catch {
    return false;
  }
}

type RingStat = { n: number; sum: number; dark: number; light: number };

function emptyRing(): RingStat {
  return { n: 0, sum: 0, dark: 0, light: 0 };
}

function analogGaugeSignature(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): boolean {
  if (width < 24 || height < 24) return false;
  const cx = width / 2;
  const cy = height / 2;
  const rMax = Math.min(width, height) / 2;
  const hub = emptyRing();
  const face = emptyRing();
  const bezel = emptyRing();
  let midN = 0;
  let midInside = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const luma =
        0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
      const rad = Math.hypot((x - cx) / rMax, (y - cy) / rMax);
      if (luma > 80 && luma < 200) {
        midN += 1;
        if (rad <= 1) midInside += 1;
      }
      const ring = rad < 0.35 ? hub : rad < 0.72 ? face : rad < 1.02 ? bezel : null;
      if (!ring) continue;
      ring.n += 1;
      ring.sum += luma;
      if (luma < 70) ring.dark += 1;
      if (luma > 150) ring.light += 1;
    }
  }

  if (hub.n < 80 || face.n < 160 || bezel.n < 160) return false;
  const hubMean = hub.sum / hub.n;
  const faceMean = face.sum / face.n;
  const bezelMean = bezel.sum / bezel.n;
  const hubDark = hub.dark / hub.n;
  const hubLight = hub.light / hub.n;
  const faceLight = face.light / face.n;
  const bezelDark = bezel.dark / bezel.n;
  const midCirc = midInside / Math.max(1, midN);
  const darkerBezel = bezelMean <= hubMean - 12 || bezelDark >= hubDark + 0.12;
  return (
    hubMean >= 125 &&
    hubDark < 0.08 &&
    hubLight >= 0.22 &&
    faceMean >= 88 &&
    faceLight >= 0.12 &&
    darkerBezel &&
    midCirc >= 0.55
  );
}

function mercosulGlyphSignature(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
): boolean {
  if (width < 12 || height < 12) return false;
  const topEnd = Math.max(2, Math.round(height * 0.28));
  const lowerStart = Math.round(height * 0.45);
  let topN = 0;
  let topBlue = 0;
  let lowerN = 0;
  let lowerBlue = 0;
  let lowerDark = 0;
  let lowerLight = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const blue = isMercosulBlue(r, g, b);
      if (y < topEnd) {
        topN += 1;
        if (blue) topBlue += 1;
      }
      if (y >= lowerStart) {
        lowerN += 1;
        if (blue) lowerBlue += 1;
        if (luma < 70) lowerDark += 1;
        if (luma > 150) lowerLight += 1;
      }
    }
  }
  if (topN === 0 || lowerN === 0) return false;
  return (
    topBlue / topN >= 0.08 &&
    lowerBlue / lowerN < 0.14 &&
    lowerDark / lowerN >= 0.18 &&
    lowerLight / lowerN >= 0.2
  );
}

/**
 * Relógio/display de moto ou carro: miolo claro sem letras e aro mais escuro.
 * Recorte justo de placa Mercosul com caracteres no corpo não casa.
 */
export async function looksLikeAnalogGaugeAround(
  image: Buffer,
  box: PixelBox,
): Promise<boolean> {
  if (box.width < 8 || box.height < 8) return false;
  try {
    const local = await sharp(image, { failOn: "none" })
      .extract({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    if (
      mercosulGlyphSignature(
        local.data,
        local.info.width,
        local.info.height,
        local.info.channels,
      )
    ) {
      return false;
    }

    if (
      analogGaugeSignature(
        local.data,
        local.info.width,
        local.info.height,
        local.info.channels,
      )
    ) {
      return true;
    }

    const meta = await sharp(image, { failOn: "none" }).metadata();
    const imageWidth = meta.width ?? 0;
    const imageHeight = meta.height ?? 0;
    if (!imageWidth || !imageHeight) return false;

    const scales = [2.1, 3.2];
    for (let index = 0; index < scales.length; index += 1) {
      const size = Math.min(
        Math.max(imageWidth, imageHeight),
        Math.max(96, Math.round(Math.max(box.width, box.height) * scales[index])),
      );
      let cx = box.left + box.width / 2;
      let cy = box.top + box.height / 2;
      // Caixa no canto: o relógio fica para dentro do quadro, não para fora.
      if (box.left <= imageWidth * 0.08) cx += size * 0.22;
      if (box.left + box.width >= imageWidth * 0.92) cx -= size * 0.22;
      if (box.top <= imageHeight * 0.08) cy += size * 0.22;
      if (box.top + box.height >= imageHeight * 0.92) cy -= size * 0.22;
      const left = Math.max(
        0,
        Math.min(Math.round(cx - size / 2), Math.max(0, imageWidth - size)),
      );
      const top = Math.max(
        0,
        Math.min(Math.round(cy - size / 2), Math.max(0, imageHeight - size)),
      );
      const neighborhood = {
        left,
        top,
        width: Math.min(size, imageWidth - left),
        height: Math.min(size, imageHeight - top),
      };
      const extracted = await sharp(image, { failOn: "none" })
        .extract({
          left: neighborhood.left,
          top: neighborhood.top,
          width: neighborhood.width,
          height: neighborhood.height,
        })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      if (
        analogGaugeSignature(
          extracted.data,
          extracted.info.width,
          extracted.info.height,
          extracted.info.channels,
        )
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Placa Mercosul (carro ou moto): faixa azul + corpo claro. Não é portinhola
 * nem relógio/painel com reflexo azulado.
 */
export async function looksLikeMercosulPlatePatch(
  image: Buffer,
  box: PixelBox,
): Promise<boolean> {
  if (box.width < 8 || box.height < 8) return false;
  try {
    const extracted = await sharp(image, { failOn: "none" })
      .extract({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { data, info } = extracted;
    const width = info.width;
    const height = info.height;
    const channels = info.channels;
    const count = width * height;
    if (count <= 0) return false;

    let blue = 0;
    let light = 0;
    const topEnd = Math.max(2, Math.round(height * 0.4));
    let topBlue = 0;
    let topN = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * channels;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        if (isMercosulBlue(r, g, b)) blue += 1;
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luma > 150) light += 1;
        if (y < topEnd) {
          topN += 1;
          if (isMercosulBlue(r, g, b)) topBlue += 1;
        }
      }
    }
    const lightRatio = light / count;
    if (lightRatio < 0.1) return false;
    const blueRatio = blue / count;
    const topBlueRatio = topBlue / Math.max(1, topN);
    if (!(blueRatio >= 0.05 || topBlueRatio >= 0.12)) return false;
    if (await looksLikeAnalogGaugeAround(image, box)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function looksLikeBodyPanelFalsePositive(
  image: Buffer,
  box: PixelBox,
): Promise<boolean> {
  if (await looksLikeAnalogGaugeAround(image, box)) return true;
  if (await looksLikeMercosulPlatePatch(image, box)) return false;
  if (isUnlikelyPlateGeometry(box)) return true;
  try {
    const extracted = await sharp(image, { failOn: "none" })
      .extract({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const signals = measureDealerPatch(
      extracted.data,
      extracted.info.width,
      extracted.info.height,
      extracted.info.channels,
      {
        left: 0,
        top: 0,
        width: extracted.info.width,
        height: extracted.info.height,
      },
    );
    if (!signals) return true;
    return looksLikeBodyPanelPatch(signals);
  } catch {
    return false;
  }
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

  const signals = measureDealerPatch(data, width, height, channels, box);
  if (!signals) return 0;
  if (looksLikeBodyPanelPatch(signals)) return 0;
  if (signals.insetLight < 0.1) return 0;

  let blueish = 0;
  let count = 0;

  for (let y = box.top; y < box.top + box.height; y += 1) {
    for (let x = box.left; x < box.left + box.width; x += 1) {
      const offset = (y * width + x) * channels;
      count += 1;
      if (isMercosulBlue(data[offset], data[offset + 1], data[offset + 2])) {
        blueish += 1;
      }
    }
  }
  if (count === 0) return 0;

  const darkRatio = signals.darkRatio;
  const blackRatio = signals.blackRatio;
  const lightRatio = signals.lightRatio;
  const whiteRatio = signals.whiteRatio;
  const blueRatio = blueish / count;
  const mean = signals.mean;
  const stdev = signals.stdev;

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
  const width = Math.min(imageWidth, Math.max(96, Math.round(box.width * 2.5)));
  // AUTOMÓVEIS é a linha de baixo — sobe para achar FORTE e o logo.
  const height = Math.min(imageHeight, Math.max(72, Math.round(box.height * 4.2)));
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const left = Math.max(0, Math.round(cx - width / 2));
  const top = Math.max(0, Math.round(cy - height * 0.72));
  return {
    left: Math.min(left, Math.max(0, imageWidth - width)),
    top: Math.min(top, Math.max(0, imageHeight - height)),
    width: Math.min(width, imageWidth - Math.min(left, imageWidth - width)),
    height: Math.min(height, imageHeight - Math.min(top, imageHeight - height)),
  };
}

/** Corta o retângulo preto para a vizinhança do OCR — evita saia/farol. */
function clipDealerVisualToOcr(visual: PixelBox, ocr: PixelBox): PixelBox {
  const aspect = visual.width / Math.max(1, visual.height);
  const compactEnough =
    visual.width <= ocr.width * 2.25 &&
    visual.height <= Math.max(ocr.height * 5.2, Math.round(visual.width / 2.15));
  if (aspect >= 1.7 && aspect <= 4.6 && compactEnough) {
    return unionBox([visual, ocr]);
  }
  const maxLeft = Math.max(12, Math.round(ocr.width * 0.55));
  const maxRight = Math.max(8, Math.round(ocr.width * 0.3));
  const maxTop = Math.max(6, Math.round(ocr.height * 0.7));
  const maxBottom = Math.max(8, Math.round(ocr.height * 1.6));
  const left = Math.max(visual.left, ocr.left - maxLeft);
  const top = Math.max(visual.top, ocr.top - maxTop);
  const right = Math.min(
    visual.left + visual.width,
    ocr.left + ocr.width + maxRight,
  );
  const bottom = Math.min(
    visual.top + visual.height,
    ocr.top + ocr.height + maxBottom,
  );
  return {
    left,
    top,
    width: Math.max(8, right - left),
    height: Math.max(6, bottom - top),
  };
}

function pickBestDealerBoxes(
  boxes: PixelBox[],
  imageWidth: number,
): PixelBox[] {
  const merged = mergeUnionBoxes(boxes);
  if (merged.length <= 1) return merged;
  const centerX = imageWidth / 2;
  const sorted = [...merged].sort((a, b) => {
    const aDist = Math.abs(a.left + a.width / 2 - centerX);
    const bDist = Math.abs(b.left + b.width / 2 - centerX);
    if (Math.abs(aDist - bDist) > 28) return aDist - bDist;
    return boxArea(a) - boxArea(b);
  });
  return [sorted[0]];
}

export async function dealerBoxesFromImage(
  image: Buffer,
  pieces: TextPiece[],
  imageWidth: number,
  imageHeight: number,
): Promise<PixelBox[]> {
  // Só com OCR FORTE/AUTOMÓVEIS. Sem texto, o retângulo preto pega friso/roda.
  const ocrGroups = unpaddedDealerGroups(pieces, imageWidth, imageHeight);
  if (ocrGroups.length === 0) return [];

  const confirmed: PixelBox[] = [];
  for (let index = 0; index < ocrGroups.length; index += 1) {
    const ocr = ocrGroups[index].box;
    const search = regionAroundBox(ocr, imageWidth, imageHeight);
    const visual = await findBlackDealerPlateBoxes(image, search);
    const overlapping = visual
      .map((box) => completeDealerVisual(box, imageWidth, imageHeight))
      .filter(
        (box) =>
          isPlausibleDealerBox(box, imageWidth, imageHeight) &&
          (boxesOverlap(box, ocr) || boxContainsCenter(box, ocr)),
      )
      .sort(
        (a, b) =>
          overlapArea(b, ocr) - overlapArea(a, ocr) || boxArea(a) - boxArea(b),
      );

    let candidate: PixelBox | null = null;
    if (overlapping.length > 0) {
      const clipped = clipDealerVisualToOcr(overlapping[0], ocr);
      candidate = padDealerBoxTight(
        unionBox([clipped, ocr]),
        imageWidth,
        imageHeight,
      );
    } else if (ocrGroups[index].hasForte) {
      const paddedOcr = padDealerBox(ocr, imageWidth, imageHeight);
      const probe =
        (await looksLikeConfirmedDealerPlate(image, ocr)) ||
        (await looksLikeConfirmedDealerPlate(image, paddedOcr));
      if (!probe) continue;
      if (await looksLikeBodyPanelFalsePositive(image, paddedOcr)) continue;
      candidate = paddedOcr;
    } else {
      // AUTOMÓVEIS sozinho só vale se o retângulo preto estiver debaixo.
      continue;
    }

    if (!candidate) continue;
    if (!isPlausibleDealerBox(candidate, imageWidth, imageHeight)) {
      const fallback = padDealerBoxTight(ocr, imageWidth, imageHeight);
      if (
        !isPlausibleDealerBox(fallback, imageWidth, imageHeight) ||
        !(await looksLikeConfirmedDealerPlate(image, fallback))
      ) {
        continue;
      }
      candidate = fallback;
    }
    if (await looksLikeBodyPanelFalsePositive(image, candidate)) {
      const fallback = padDealerBoxTight(ocr, imageWidth, imageHeight);
      if (
        (await looksLikeBodyPanelFalsePositive(image, fallback)) ||
        !(await looksLikeConfirmedDealerPlate(image, fallback))
      ) {
        continue;
      }
      candidate = fallback;
    }
    if (!(await looksLikeConfirmedDealerPlate(image, candidate))) {
      if (overlapping.length === 0) continue;
    }
    confirmed.push(candidate);
  }

  return pickBestDealerBoxes(confirmed, imageWidth);
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
    // Teto curto: o corpo branco é medido em fitMercosulPlateBody, não chutado.
    if (aspect < 1.75) {
      height = Math.max(height + 8, Math.round(blob.width * 1.05));
    } else if (aspect <= 3.5) {
      height = Math.max(height + 6, Math.round(blob.width * 0.75));
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

function isMercosulPlateRow(
  data: Buffer,
  width: number,
  channels: number,
  y: number,
  x0: number,
  x1: number,
) {
  let blue = 0;
  let light = 0;
  let sum = 0;
  let n = 0;
  for (let x = x0; x < x1; x += 1) {
    const offset = (y * width + x) * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += luma;
    n += 1;
    if (isMercosulBlue(r, g, b)) blue += 1;
    if (luma > 140) light += 1;
  }
  if (n === 0) return false;
  if (blue / n >= 0.1) return true;
  return light / n >= 0.28 && sum / n >= 95;
}

/**
 * Corta a caixa na transição placa clara → para-lama escuro, em vez de
 * esticar a faixa azul até 1.25× a largura (borrava o rabo da moto).
 */
function fitMercosulPlateBody(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  blob: BlueBlob,
  shaped: PixelBox,
): PixelBox {
  const inset = Math.max(1, Math.round(shaped.width * 0.1));
  const x0 = Math.max(0, shaped.left + inset);
  const x1 = Math.min(width, shaped.left + shaped.width - inset);
  const maxY = Math.min(
    height - 1,
    blob.top + Math.max(shaped.height, Math.round(blob.width * 1.15)),
  );
  let last = Math.min(height - 1, blob.top + blob.height - 1);
  let misses = 0;
  for (let y = blob.top; y <= maxY; y += 1) {
    if (isMercosulPlateRow(data, width, channels, y, x0, x1)) {
      last = y;
      misses = 0;
      continue;
    }
    if (y > blob.top + blob.height) {
      misses += 1;
      if (misses >= 2) break;
    }
  }
  const fitted = last - blob.top + 1;
  const minH = Math.max(blob.height + 6, Math.round(blob.width * 0.55));
  const maxH = Math.max(minH, Math.round(blob.width * 1.15));
  const plateH = Math.min(
    height - blob.top,
    Math.min(maxH, Math.max(minH, fitted)),
  );

  const y0 = blob.top;
  const y1 = Math.min(height, blob.top + plateH);
  let left = shaped.left;
  let right = shaped.left + shaped.width - 1;
  while (
    left < right &&
    !isMercosulPlateCol(data, width, channels, left, y0, y1)
  ) {
    left += 1;
  }
  while (
    right > left &&
    !isMercosulPlateCol(data, width, channels, right, y0, y1)
  ) {
    right -= 1;
  }
  const minW = Math.max(16, Math.round(blob.width * 0.72));
  let plateW = right - left + 1;
  if (plateW < minW) {
    left = shaped.left;
    plateW = shaped.width;
  }

  return {
    left,
    top: blob.top,
    width: plateW,
    height: plateH,
  };
}

function isMercosulPlateCol(
  data: Buffer,
  width: number,
  channels: number,
  x: number,
  y0: number,
  y1: number,
) {
  let blue = 0;
  let light = 0;
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    const offset = (y * width + x) * channels;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += luma;
    n += 1;
    if (isMercosulBlue(r, g, b)) blue += 1;
    if (luma > 140) light += 1;
  }
  if (n === 0) return false;
  if (blue / n >= 0.08) return true;
  return light / n >= 0.22 && sum / n >= 90;
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
    const fitted = fitMercosulPlateBody(
      data,
      width,
      height,
      channels,
      blob,
      shaped,
    );
    // Cromado no corte do para-choque vira blob no topo da região.
    if (fitted.top <= 2 && fitted.height < 22) continue;
    if (fitted.width < 16 || fitted.height < 12) continue;
    if (fitted.width * fitted.height < 280) continue;
    const absolute = {
      left: region.left + fitted.left,
      top: region.top + fitted.top,
      width: fitted.width,
      height: fitted.height,
    };
    // Grade/cromado do Civic acende azul, mas não tem corpo branco de placa.
    // Relógio/painel (Honda PGM-FI) também pinta azul no visor — não é placa.
    if (await looksLikeAnalogGaugeAround(image, absolute)) continue;
    if (!(await looksLikeMercosulPlatePatch(image, absolute))) continue;
    boxes.push(absolute);
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
  const motorcycles: PixelBox[] = [];
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
      const isMotorcycle = /^(motorcycle|motorbike|scooter|moped)$/i.test(name);
      if (!isPlate && !isCar && !isMotorcycle) continue;
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
        if (
          isMotorcycle &&
          boxArea(box) / (imageWidth * imageHeight) >= 0.05
        ) {
          motorcycles.push(box);
        }
      }
    }
  } catch (error) {
    console.warn("[blur-plates] DetectLabels falhou — segue só o texto:", error);
  }
  return { cars, plates, motorcycles };
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

function motorcyclePlateSearchRegion(
  moto: PixelBox,
  imageWidth: number,
  imageHeight: number,
): PixelBox | null {
  // Traseira da moto: metade inferior, quase a largura toda (lateral 3/4).
  const top = Math.max(0, moto.top + Math.round(moto.height * 0.28));
  const bottom = Math.min(
    imageHeight,
    moto.top + moto.height + Math.round(moto.height * 0.16),
  );
  const left = Math.max(0, moto.left - Math.round(moto.width * 0.06));
  const right = Math.min(
    imageWidth,
    moto.left + moto.width + Math.round(moto.width * 0.06),
  );
  const width = right - left;
  const height = bottom - top;
  if (width < 20 || height < 16) return null;
  return { left, top, width, height };
}

function lowerFrameSearchRegion(
  imageWidth: number,
  imageHeight: number,
): PixelBox {
  const top = Math.round(imageHeight * 0.18);
  return {
    left: 0,
    top,
    width: imageWidth,
    height: Math.max(16, imageHeight - top),
  };
}

/**
 * Varredura visual da faixa inferior — pega placa de moto mesmo sem label
 * de carro/moto no Rekognition (caso da Biz no painel).
 */
export async function findMercosulPlatesInImage(
  image: Buffer,
  imageWidth: number,
  imageHeight: number,
): Promise<PixelBox[]> {
  const region = lowerFrameSearchRegion(imageWidth, imageHeight);
  const found = await findMercosulStripeBoxes(image, region);
  const boxes: PixelBox[] = [];
  for (let index = 0; index < found.length; index += 1) {
    const accepted = acceptFoundBox(found[index], imageWidth, imageHeight);
    if (accepted) boxes.push(accepted);
  }
  return mergeOverlappingBoxes(boxes);
}

async function findPlatesWithoutReadableText(
  client: RekognitionClient,
  bytes: Buffer,
  imageWidth: number,
  imageHeight: number,
): Promise<PixelBox[]> {
  const labels = await detectVehicleLabels(client, bytes, imageWidth, imageHeight);
  const boxes: PixelBox[] = [];

  const pushAccepted = (box: PixelBox) => {
    const accepted = acceptFoundBox(box, imageWidth, imageHeight);
    if (accepted) boxes.push(accepted);
  };

  for (let index = 0; index < labels.plates.length; index += 1) {
    pushAccepted(labels.plates[index]);
  }

  for (let index = 0; index < labels.cars.length; index += 1) {
    const region = bumperSearchRegion(labels.cars[index], imageWidth, imageHeight);
    if (!region) continue;
    const found = await findMercosulStripeBoxes(bytes, region);
    for (let boxIndex = 0; boxIndex < found.length; boxIndex += 1) {
      pushAccepted(found[boxIndex]);
    }
  }

  for (let index = 0; index < labels.motorcycles.length; index += 1) {
    const region = motorcyclePlateSearchRegion(
      labels.motorcycles[index],
      imageWidth,
      imageHeight,
    );
    if (!region) continue;
    const found = await findMercosulStripeBoxes(bytes, region);
    for (let boxIndex = 0; boxIndex < found.length; boxIndex += 1) {
      pushAccepted(found[boxIndex]);
    }
  }

  const fallback = await findMercosulPlatesInImage(bytes, imageWidth, imageHeight);
  boxes.push(...fallback);

  const filtered = disambiguateCarPlates(
    boxes,
    labels.cars,
    imageWidth,
    imageHeight,
    labels.motorcycles,
  );
  const merged = mergeOverlappingBoxes(filtered);
  const confirmed: PixelBox[] = [];
  for (let index = 0; index < merged.length; index += 1) {
    if (await looksLikeBodyPanelFalsePositive(bytes, merged[index])) continue;
    confirmed.push(merged[index]);
  }
  return confirmed;
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
  motorcycles: PixelBox[] = [],
): PixelBox[] {
  if (boxes.length === 0) return [];

  const validBoxes: PixelBox[] = [];
  for (const box of boxes) {
    const parentMoto =
      motorcycles.find((moto) => boxesOverlap(moto, box)) ?? null;
    const parentCar = cars.find((c) => boxesOverlap(c, box)) ?? null;
    if (
      parentMoto &&
      (!parentCar || overlapArea(parentMoto, box) >= overlapArea(parentCar, box))
    ) {
      validBoxes.push(box);
      continue;
    }
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
    if (
      !box.allowDark &&
      ((await looksLikeDarkDisplay(image, box)) ||
        (await looksLikeAnalogGaugeAround(image, box)))
    ) {
      continue;
    }

    const dealer = Boolean(box.allowDark);
    const shortSide = Math.min(box.width, box.height);
    const aspect = box.width / Math.max(1, box.height);
    const compact = aspect <= 1.7;
    const smallPlate = shortSide < 40;
    const strong = dealer || smallPlate || compact;
    const sigma = Math.min(
      dealer ? 42 : 36,
      Math.max(dealer ? 22 : 16, Math.round(shortSide / (strong ? 1.7 : 2.4))),
    );
    const radius = Math.max(
      1,
      Math.round(shortSide * (dealer ? 0.04 : compact ? 0.05 : smallPlate ? 0.08 : 0.14)),
    );
    const feather = dealer
      ? 0.1
      : compact
        ? 0.15
        : smallPlate
          ? 0.25
          : Math.max(0.4, shortSide * 0.02);
    const inset = 0;
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

    let pipeline = sharp(image, { failOn: "none" }).extract({
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    });
    if (dealer) {
      const pixelW = Math.max(8, Math.round(box.width / 6));
      const pixelH = Math.max(6, Math.round(box.height / 6));
      pipeline = pipeline.resize(pixelW, pixelH).resize(box.width, box.height);
    }
    const blurred = await pipeline
      .blur(sigma)
      .blur(Math.max(dealer ? 8 : 6, Math.round(sigma * (dealer ? 0.55 : 0.45))))
      .modulate(dealer ? { brightness: 0.76 } : { brightness: 1 })
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
 * alterar o caminho da Mercosul, e placa Mercosul de moto (duas linhas,
 * aspecto ~1:1) via faixa azul + geometria própria.
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
      if (await looksLikeAnalogGaugeAround(bytes, box)) continue;
      if (await looksLikeDarkDisplay(bytes, box)) continue;
      if (await looksLikeBodyPanelFalsePositive(bytes, box)) continue;
      plateBoxes.push(box);
    }

    const dealerBoxes = await dealerBoxesFromImage(bytes, pieces, width, height);
    const plates: PixelBox[] = [];
    for (const box of plateBoxes) {
      if (dealerBoxes.some((dealer) => boxesOverlap(dealer, box))) continue;
      if (
        dealerBoxes.length > 0 &&
        !(await looksLikeMercosulPlatePatch(bytes, box))
      ) {
        continue;
      }
      plates.push(box);
    }

    const blurBoxes: BlurBox[] = [
      ...plates.map((box) => ({ ...box, allowDark: false })),
      ...dealerBoxes.map((box) => ({ ...box, allowDark: true })),
    ];

    if (blurBoxes.length === 0) {
      console.warn("[blur-plates] nenhuma placa reconhecida.");
      return input;
    }

    console.info(
      `[blur-plates] ${plates.length} placa(s) + ${dealerBoxes.length} placa(s) de loja — aplicando blur.`,
    );

    return await applyBlurRegions(bytes, blurBoxes);
  } catch (error) {
    console.error("[blur-plates] falha no Rekognition/blur — upload segue:", error);
    return input;
  }
}
