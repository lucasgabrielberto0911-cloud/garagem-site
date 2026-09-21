/** Retângulos normalizados (0–1) marcados na foto do admin. Sem detector. */

export const MAX_MANUAL_BLUR_RECTS = 8;

/** Menor lado do retângulo na tela, para ignorar um toque acidental. */
export const MIN_DRAW_PX = 12;

/** Fração mínima da foto. Abaixo disso o servidor recusa o retângulo. */
const MIN_NORM = 0.004;

export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PixelRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export class BlurRectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlurRectError";
  }
}

function clamp01(value: number) {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function rectFromPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
): NormalizedRect {
  const x1 = clamp01(start.x);
  const y1 = clamp01(start.y);
  const x2 = clamp01(end.x);
  const y2 = clamp01(end.y);
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };
}

export function isDrawableRect(
  rect: NormalizedRect,
  displayWidth: number,
  displayHeight: number,
) {
  return (
    rect.width * displayWidth >= MIN_DRAW_PX &&
    rect.height * displayHeight >= MIN_DRAW_PX
  );
}

export function clampNormalizedRect(input: unknown): NormalizedRect | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const x = Number(raw.x);
  const y = Number(raw.y);
  const width = Number(raw.width);
  const height = Number(raw.height);
  if (![x, y, width, height].every((value) => Number.isFinite(value))) {
    return null;
  }
  if (width <= 0 || height <= 0) return null;

  const left = clamp01(x);
  const top = clamp01(y);
  const right = clamp01(x + width);
  const bottom = clamp01(y + height);
  const nextWidth = right - left;
  const nextHeight = bottom - top;
  if (nextWidth < MIN_NORM || nextHeight < MIN_NORM) return null;
  return { x: left, y: top, width: nextWidth, height: nextHeight };
}

export function parseBlurRects(input: unknown): NormalizedRect[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BlurRectError("Marque a placa com um retângulo.");
  }
  if (input.length > MAX_MANUAL_BLUR_RECTS) {
    throw new BlurRectError(
      `No máximo ${MAX_MANUAL_BLUR_RECTS} retângulos por foto.`,
    );
  }

  const rects: NormalizedRect[] = [];
  for (const item of input) {
    const rect = clampNormalizedRect(item);
    if (!rect) {
      throw new BlurRectError(
        "Retângulo inválido. Marque de novo sobre a placa.",
      );
    }
    rects.push(rect);
  }
  return rects;
}

/**
 * Converte a fração da foto em pixels inteiros, cobrindo o retângulo
 * (floor/ceil) e recortando na borda da imagem.
 */
export function normalizedRectToPixels(
  rect: NormalizedRect,
  imageWidth: number,
  imageHeight: number,
): PixelRect | null {
  if (imageWidth < 4 || imageHeight < 4) return null;
  const left = clampInt(Math.floor(rect.x * imageWidth), 0, imageWidth - 1);
  const top = clampInt(Math.floor(rect.y * imageHeight), 0, imageHeight - 1);
  const right = clampInt(
    Math.ceil((rect.x + rect.width) * imageWidth),
    left + 1,
    imageWidth,
  );
  const bottom = clampInt(
    Math.ceil((rect.y + rect.height) * imageHeight),
    top + 1,
    imageHeight,
  );
  const width = right - left;
  const height = bottom - top;
  if (width < 4 || height < 4) return null;
  return { left, top, width, height };
}

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}
