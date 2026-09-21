import sharp from "sharp";
import {
  BlurRectError,
  normalizedRectToPixels,
  parseBlurRects,
  type NormalizedRect,
  type PixelRect,
} from "@/lib/blur-rects";

/**
 * Borra só os retângulos marcados. Pixelização grosseira + desfoque
 * para os caracteres da placa ficarem ilegíveis. O resto da foto permanece.
 * Não chama detector nenhum.
 */
export async function blurImageRegions(
  input: Buffer,
  rects: NormalizedRect[],
): Promise<Buffer> {
  const parsed = parseBlurRects(rects);
  const oriented = await sharp(input, { failOn: "none" }).rotate().toBuffer();
  const meta = await sharp(oriented, { failOn: "none" }).metadata();
  const imageWidth = meta.width ?? 0;
  const imageHeight = meta.height ?? 0;
  if (!imageWidth || !imageHeight) {
    throw new BlurRectError("Não foi possível ler a foto.");
  }

  const boxes = parsed
    .map((rect) => normalizedRectToPixels(rect, imageWidth, imageHeight))
    .filter((box): box is PixelRect => box !== null);

  if (boxes.length === 0) {
    throw new BlurRectError(
      "O retângulo ficou pequeno demais. Marque uma área maior sobre a placa.",
    );
  }

  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (const box of boxes) {
    composites.push({
      input: await pixelateRegion(oriented, box),
      left: box.left,
      top: box.top,
    });
  }

  return sharp(oriented, { failOn: "none" })
    .composite(composites)
    .png()
    .toBuffer();
}

async function pixelateRegion(image: Buffer, box: PixelRect): Promise<Buffer> {
  // Poucos blocos: um caractere não cabe num bloco. O desfoque depois
  // apaga a borda entre os blocos.
  const cols = Math.min(8, Math.max(2, Math.round(box.width / 36)));
  const rows = Math.min(3, Math.max(2, Math.round(box.height / 18)));
  const shortSide = Math.min(box.width, box.height);
  const sigma = Math.min(18, Math.max(0.8, shortSide / 3));

  return sharp(image, { failOn: "none" })
    .extract({
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
    })
    .resize(cols, rows, { kernel: "nearest", fit: "fill" })
    .resize(box.width, box.height, { kernel: "nearest", fit: "fill" })
    .blur(sigma)
    .blur(Math.max(0.8, sigma * 0.45))
    .toBuffer();
}
