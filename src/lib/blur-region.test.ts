import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { blurImageRegions } from "./blur-region";
import { encodeCardImage, encodeGalleryImage } from "./image-variants";
import {
  BlurRectError,
  isDrawableRect,
  normalizedRectToPixels,
  parseBlurRects,
  rectFromPoints,
  type NormalizedRect,
  type PixelRect,
} from "./blur-rects";

const WIDTH = 640;
const HEIGHT = 360;

function paint(
  raw: Buffer,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number],
) {
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      const index = (row * WIDTH + col) * 3;
      raw[index] = color[0];
      raw[index + 1] = color[1];
      raw[index + 2] = color[2];
    }
  }
}

/** Barras finas pretas/brancas — legíveis como “caracteres” antes do borrão. */
function paintBars(raw: Buffer, x: number, y: number, w: number, h: number) {
  for (let row = y; row < y + h; row += 1) {
    for (let col = x; col < x + w; col += 1) {
      const on = Math.floor((col - x) / 3) % 2 === 0;
      const value = on ? 15 : 245;
      const index = (row * WIDTH + col) * 3;
      raw[index] = value;
      raw[index + 1] = value;
      raw[index + 2] = value;
    }
  }
}

async function plateImage() {
  const raw = Buffer.alloc(WIDTH * HEIGHT * 3, 0);
  paint(raw, 0, 0, WIDTH, HEIGHT, [36, 72, 96]);
  paintBars(raw, 200, 150, 180, 48);
  paintBars(raw, 48, 210, 72, 40);
  return sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
    .png()
    .toBuffer();
}

const plate: NormalizedRect = {
  x: 200 / WIDTH,
  y: 150 / HEIGHT,
  width: 180 / WIDTH,
  height: 48 / HEIGHT,
};

const dealer: NormalizedRect = {
  x: 48 / WIDTH,
  y: 210 / HEIGHT,
  width: 72 / WIDTH,
  height: 40 / HEIGHT,
};

async function stdev(buffer: Buffer, box: PixelRect) {
  // stats() ignora operações na mesma instância — extrai para um buffer antes.
  const extracted = await sharp(buffer).extract(box).removeAlpha().png().toBuffer();
  const stats = await sharp(extracted).stats();
  return (
    (stats.channels[0].stdev +
      stats.channels[1].stdev +
      stats.channels[2].stdev) /
    3
  );
}

async function rawBox(buffer: Buffer, box: PixelRect) {
  return sharp(buffer).extract(box).removeAlpha().raw().toBuffer();
}

async function maxNeighborDelta(buffer: Buffer, box: PixelRect) {
  const raw = await rawBox(buffer, box);
  let maxDelta = 0;
  for (let y = 0; y < box.height; y += 1) {
    for (let x = 0; x < box.width - 1; x += 1) {
      const index = (y * box.width + x) * 3;
      maxDelta = Math.max(maxDelta, Math.abs(raw[index] - raw[index + 3]));
    }
  }
  return maxDelta;
}

test("retângulo do mouse vira fração e pixel na foto inteira", () => {
  const rect = rectFromPoints({ x: 0.2, y: 1.4 }, { x: -0.1, y: 0.4 });
  assert.equal(rect.x, 0);
  assert.equal(rect.y, 0.4);
  assert.ok(Math.abs(rect.width - 0.2) < 1e-9);
  assert.ok(Math.abs(rect.height - 0.6) < 1e-9);
  assert.equal(isDrawableRect(rect, 400, 300), true);
  assert.equal(
    isDrawableRect({ x: 0.1, y: 0.1, width: 0.01, height: 0.2 }, 400, 300),
    false,
  );

  const pixels = normalizedRectToPixels(plate, WIDTH, HEIGHT);
  assert.ok(pixels);
  assert.equal(pixels.left, 200);
  assert.equal(pixels.top, 150);
  assert.ok(pixels.width >= 180 && pixels.width <= 181);
  assert.ok(pixels.height >= 48 && pixels.height <= 49);
});

test("parse recusa vazio, lixo e estoura o limite", () => {
  assert.throws(() => parseBlurRects([]), BlurRectError);
  assert.throws(() => parseBlurRects(null), BlurRectError);
  assert.throws(
    () => parseBlurRects([{ x: 0, y: 0, width: 0, height: 0.2 }]),
    BlurRectError,
  );
  assert.throws(
    () =>
      parseBlurRects(
        Array.from({ length: 9 }, () => ({
          x: 0.1,
          y: 0.1,
          width: 0.2,
          height: 0.2,
        })),
      ),
    BlurRectError,
  );

  const clamped = parseBlurRects([
    { x: -0.2, y: 0.1, width: 0.4, height: 0.2 },
  ]);
  assert.equal(clamped[0].x, 0);
  assert.ok(clamped[0].width > 0.15);
});

test("borra só o retângulo e deixa o resto da foto igual", async () => {
  const image = await plateImage();
  const before = await stdev(image, { left: 210, top: 158, width: 150, height: 28 });
  assert.ok(before > 70, `contraste original baixo: ${before}`);

  const blurred = await blurImageRegions(image, [plate]);
  const region = { left: 210, top: 158, width: 150, height: 28 };
  const after = await stdev(blurred, region);
  assert.ok(after < 12, `caracteres ainda legíveis: stdev ${after}`);
  assert.ok(after < before * 0.15, `${before} → ${after}`);
  const edges = await maxNeighborDelta(blurred, region);
  assert.ok(edges < 12, `ainda há traço de caractere: salto ${edges}`);

  const outside = { left: 8, top: 8, width: 24, height: 24 };
  assert.deepEqual(await rawBox(image, outside), await rawBox(blurred, outside));

  const between = { left: 130, top: 168, width: 40, height: 20 };
  assert.deepEqual(await rawBox(image, between), await rawBox(blurred, between));
});

test("dois retângulos e um segundo passe não desfazem o primeiro", async () => {
  const image = await plateImage();
  const once = await blurImageRegions(image, [plate, dealer]);
  const plateStd = await stdev(once, { left: 210, top: 158, width: 150, height: 28 });
  const dealerStd = await stdev(once, { left: 56, top: 218, width: 52, height: 22 });
  assert.ok(plateStd < 15, `placa ${plateStd}`);
  assert.ok(dealerStd < 20, `loja ${dealerStd}`);
  assert.ok(
    (await maxNeighborDelta(once, { left: 56, top: 218, width: 52, height: 22 })) <
      12,
    "placa da loja ainda tem aresta de caractere",
  );

  const bumper = { left: 400, top: 40, width: 30, height: 30 };
  assert.deepEqual(await rawBox(image, bumper), await rawBox(once, bumper));

  const twice = await blurImageRegions(once, [dealer]);
  const plateAfter = await stdev(twice, {
    left: 210,
    top: 158,
    width: 150,
    height: 28,
  });
  assert.ok(plateAfter < 15, `segundo passe reviveu a placa: ${plateAfter}`);
  const dealerAfter = await stdev(twice, {
    left: 56,
    top: 218,
    width: 52,
    height: 22,
  });
  assert.ok(dealerAfter < 20, `loja no segundo passe: ${dealerAfter}`);
});

test("a foto borracha entra na galeria e na capa", async () => {
  const image = await plateImage();
  const blurred = await blurImageRegions(image, [plate]);
  const [gallery, card] = await Promise.all([
    encodeGalleryImage(blurred),
    encodeCardImage(blurred),
  ]);
  assert.equal(gallery.extension, "webp");
  assert.equal(card.extension, "webp");
  assert.ok(gallery.buffer.length > 500);
  assert.ok(card.buffer.length > 500);
  const galleryStd = await stdev(gallery.buffer, {
    left: 210,
    top: 158,
    width: 150,
    height: 28,
  });
  assert.ok(galleryStd < 20, `galeria ainda legível: ${galleryStd}`);
});

test("webp de entrada também borra a região", async () => {
  const image = await plateImage();
  const webp = await sharp(image).webp().toBuffer();
  const blurred = await blurImageRegions(webp, [plate]);
  const meta = await sharp(blurred).metadata();
  assert.equal(meta.width, WIDTH);
  assert.equal(meta.height, HEIGHT);
  const after = await stdev(blurred, { left: 210, top: 158, width: 150, height: 28 });
  assert.ok(after < 12, `webp stdev ${after}`);
});
