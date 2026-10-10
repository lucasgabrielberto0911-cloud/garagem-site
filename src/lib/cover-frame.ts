/**
 * Enquadramento da capa do card (4:3). Lógica pura, segura para o bundle do
 * cliente: o admin e o servidor calculam exatamente o mesmo recorte.
 *
 * O enquadramento mora no nome da miniatura (`<foto>-card-x500y500z100.webp`),
 * então não há coluna nova no banco e a URL muda a cada ajuste (cache longo).
 */

/** Proporção do card: 480×360. */
export const CARD_ASPECT = 4 / 3;
export const COVER_ZOOM_MIN = 100;
export const COVER_ZOOM_MAX = 300;
/** Posição da janela na folga da foto, em milésimos (500 = centro, como object-position 50%). */
export const COVER_POSITION_MAX = 1000;

export type CoverFrame = { x: number; y: number; zoom: number };
export type CropRect = { left: number; top: number; width: number; height: number };

export const DEFAULT_COVER_FRAME: CoverFrame = { x: 500, y: 500, zoom: COVER_ZOOM_MIN };

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

/** Aceita qualquer entrada (corpo de requisição) e devolve um enquadramento válido. */
export function normalizeCoverFrame(value: unknown): CoverFrame {
  const input = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof CoverFrame, unknown>>;
  return {
    x: clampInt(input.x, 0, COVER_POSITION_MAX, DEFAULT_COVER_FRAME.x),
    y: clampInt(input.y, 0, COVER_POSITION_MAX, DEFAULT_COVER_FRAME.y),
    zoom: clampInt(input.zoom, COVER_ZOOM_MIN, COVER_ZOOM_MAX, DEFAULT_COVER_FRAME.zoom),
  };
}

/** Corpo da requisição só vale se for objeto com os três números. */
export function parseCoverFrame(value: unknown): CoverFrame | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (![input.x, input.y, input.zoom].every(item => typeof item === "number" && Number.isFinite(item))) return null;
  return normalizeCoverFrame(value);
}

export function isDefaultCoverFrame(frame: CoverFrame) {
  return frame.x === DEFAULT_COVER_FRAME.x && frame.y === DEFAULT_COVER_FRAME.y && frame.zoom === DEFAULT_COVER_FRAME.zoom;
}

/** Tamanho (px da foto) da janela 4:3 sem zoom: o maior 4:3 que cabe na foto. */
function baseWindow(sourceWidth: number, sourceHeight: number) {
  return sourceWidth / sourceHeight >= CARD_ASPECT
    ? { width: sourceHeight * CARD_ASPECT, height: sourceHeight }
    : { width: sourceWidth, height: sourceWidth / CARD_ASPECT };
}

/** Janela 4:3 em pixels da foto, para este enquadramento. Inteiros, sempre dentro da foto. */
export function coverCropRect(sourceWidth: number, sourceHeight: number, frame: CoverFrame): CropRect {
  const w = Math.max(1, Math.floor(sourceWidth));
  const h = Math.max(1, Math.floor(sourceHeight));
  const safe = normalizeCoverFrame(frame);
  const base = baseWindow(w, h);
  const scale = safe.zoom / 100;
  const width = Math.min(w, Math.max(1, Math.round(base.width / scale)));
  const height = Math.min(h, Math.max(1, Math.round(base.height / scale)));
  const left = Math.round(((w - width) * safe.x) / COVER_POSITION_MAX);
  const top = Math.round(((h - height) * safe.y) / COVER_POSITION_MAX);
  return { left, top, width, height };
}

/**
 * Posiciona a foto inteira dentro da janela do card (mesma conta do recorte),
 * em porcentagem da janela. A prévia do admin usa isto: o que se vê é o que o
 * servidor grava.
 */
export function cropToCss(sourceWidth: number, sourceHeight: number, rect: CropRect) {
  return {
    width: `${(sourceWidth / rect.width) * 100}%`,
    height: `${(sourceHeight / rect.height) * 100}%`,
    left: `${(-rect.left / rect.width) * 100}%`,
    top: `${(-rect.top / rect.height) * 100}%`,
  };
}

/** Janela como fração da foto (0–1), para desenhar o retângulo sobre ela. */
export function cropToFractions(sourceWidth: number, sourceHeight: number, rect: CropRect) {
  return {
    left: rect.left / sourceWidth,
    top: rect.top / sourceHeight,
    width: rect.width / sourceWidth,
    height: rect.height / sourceHeight,
  };
}

/** Muda o zoom mantendo o centro da janela onde estava. */
export function zoomCoverFrame(sourceWidth: number, sourceHeight: number, frame: CoverFrame, zoom: number): CoverFrame {
  const current = coverCropRect(sourceWidth, sourceHeight, frame);
  const nextZoom = clampInt(zoom, COVER_ZOOM_MIN, COVER_ZOOM_MAX, frame.zoom);
  const probe = coverCropRect(sourceWidth, sourceHeight, { ...frame, zoom: nextZoom });
  const centerX = current.left + current.width / 2;
  const centerY = current.top + current.height / 2;
  return normalizeCoverFrame({
    zoom: nextZoom,
    x: positionFor(centerX - probe.width / 2, sourceWidth - probe.width, frame.x),
    y: positionFor(centerY - probe.height / 2, sourceHeight - probe.height, frame.y),
  });
}

/** Move a janela por um deslocamento em pixels da foto (arrastar). */
export function panCoverFrame(
  sourceWidth: number,
  sourceHeight: number,
  frame: CoverFrame,
  deltaX: number,
  deltaY: number,
): CoverFrame {
  const rect = coverCropRect(sourceWidth, sourceHeight, frame);
  return normalizeCoverFrame({
    zoom: frame.zoom,
    x: positionFor(rect.left + deltaX, sourceWidth - rect.width, frame.x),
    y: positionFor(rect.top + deltaY, sourceHeight - rect.height, frame.y),
  });
}

/** Sem folga no eixo, a posição não importa: mantém a anterior. */
function positionFor(left: number, slack: number, previous: number) {
  if (slack < 1) return previous;
  return Math.min(COVER_POSITION_MAX, Math.max(0, Math.round((left / slack) * COVER_POSITION_MAX)));
}

// --- nomes de arquivo ------------------------------------------------------

/**
 * Capa enquadrada grava dois arquivos com o mesmo recorte:
 *   `<foto>-card-x500y500z100-hd.webp`    480×360, o `thumbnailUrl` no banco
 *   `<foto>-card-x500y500z100-hd960.webp` 960×720, só para telas largas/densas
 * O `-hd` no nome do 480 é a garantia de que o 960 existe, então não há coluna
 * nova nem requisição às cegas. Capas antigas (`…z100.webp`, sem `-hd`) têm só
 * o 480 e continuam valendo.
 */
export const COVER_HD_WIDTH = 960;
export const COVER_HD_HEIGHT = 720;
/** Recorte menor que isto (em px da foto) não ganha nitidez ao ir para 960. */
export const COVER_HD_MIN_CROP_WIDTH = 720;

const FRAME_SUFFIX = /-card-x(\d{1,4})y(\d{1,4})z(\d{3})(-hd)?\.webp$/i;
const HD_SUFFIX = /-hd\.webp$/i;
/** Qualquer miniatura `-card` (automática, enquadrada, com ou sem 960). */
const CARD_FILE = /-card(?:-x\d{1,4}y\d{1,4}z\d{3}(?:-hd(?:960)?)?)?\.webp$/i;

/** O recorte de `rect` (px da foto) justifica gerar também o 960×720? */
export function wantsHdCard(rect: CropRect) {
  return rect.width >= COVER_HD_MIN_CROP_WIDTH;
}

export function coverFrameSuffix(frame: CoverFrame, hd = false) {
  const safe = normalizeCoverFrame(frame);
  return `-card-x${safe.x}y${safe.y}z${safe.zoom}${hd ? "-hd" : ""}.webp`;
}

/** Caminho da miniatura enquadrada, ao lado da galeria. Cada enquadramento tem seu nome. */
export function framedCardObjectPath(galleryPath: string, frame: CoverFrame, hd = false) {
  return galleryPath.replace(/(\.[a-z0-9]+)?$/i, coverFrameSuffix(frame, hd));
}

/** Enquadramento gravado no nome da miniatura, ou null para a miniatura automática. */
export function coverFrameFromCardUrl(url: string | null | undefined): CoverFrame | null {
  if (!url) return null;
  const match = FRAME_SUFFIX.exec(url.split(/[?#]/)[0] ?? "");
  if (!match) return null;
  const frame = { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
  if (frame.x > COVER_POSITION_MAX || frame.y > COVER_POSITION_MAX) return null;
  if (frame.zoom < COVER_ZOOM_MIN || frame.zoom > COVER_ZOOM_MAX) return null;
  return frame;
}

export function isFramedCardUrl(url: string | null | undefined) {
  return coverFrameFromCardUrl(url) !== null;
}

/** A miniatura enquadrada tem o par 960×720 gravado junto? */
export function hasHdCardUrl(url: string | null | undefined) {
  return isFramedCardUrl(url) && HD_SUFFIX.test((url ?? "").split(/[?#]/)[0]);
}

/**
 * Par 960×720 de uma miniatura `-hd` (caminho ou URL, query e hash preservados).
 * Null para capa automática ou enquadrada antiga: aí só existe o 480.
 */
export function hdCardCompanion(urlOrPath: string | null | undefined) {
  if (!hasHdCardUrl(urlOrPath)) return null;
  return urlOrPath!.replace(/-hd\.webp(?=[?#]|$)/i, "-hd960.webp");
}

/** Qualquer variante `-card` da galeria (caminho ou URL): não é uma foto-fonte. */
export function isCardVariantPath(urlOrPath: string) {
  return CARD_FILE.test(urlOrPath.split(/[?#]/)[0] ?? "");
}

/**
 * Mesmo enquadramento para a cópia de um anúncio: o novo `<foto>-card…` herda o
 * sufixo da miniatura de origem. Sem enquadramento, devolve o `-card.webp` padrão.
 * `hd=false` quando o 960 não pôde ser copiado: o 480 vai para o nome sem `-hd`.
 */
export function cardObjectPathLike(sourceThumbnailUrl: string | null | undefined, galleryPath: string, hd = true) {
  const frame = coverFrameFromCardUrl(sourceThumbnailUrl);
  return frame
    ? framedCardObjectPath(galleryPath, frame, hd && hasHdCardUrl(sourceThumbnailUrl))
    : galleryPath.replace(/(\.[a-z0-9]+)?$/i, "-card.webp");
}

/**
 * Caminho de foto da galeria (bucket `veiculos`) que aceita enquadramento: um
 * arquivo na raiz, que não seja miniatura nem preview.
 */
export function coverFrameSourcePath(path: string | null | undefined) {
  if (!path || path.includes("..") || path.includes("/") || path.includes("\\")) return null;
  if (!/^[0-9A-Za-z][0-9A-Za-z_.-]{0,150}\.(?:webp|jpe?g|png)$/i.test(path)) return null;
  if (isCardVariantPath(path) || /-preview\.webp$/i.test(path)) return null;
  return path;
}
