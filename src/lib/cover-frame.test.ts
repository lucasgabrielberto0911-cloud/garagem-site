import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import {
  COVER_ZOOM_MAX,
  COVER_ZOOM_MIN,
  DEFAULT_COVER_FRAME,
  cardObjectPathLike,
  coverCropRect,
  coverFrameFromCardUrl,
  coverFrameSourcePath,
  coverFrameSuffix,
  cropToCss,
  cropToFractions,
  framedCardObjectPath,
  isDefaultCoverFrame,
  isFramedCardUrl,
  normalizeCoverFrame,
  panCoverFrame,
  parseCoverFrame,
  zoomCoverFrame,
} from "./cover-frame";
import { coverMobileSrcSet, coverSrc, coverSrcSet } from "./stock-query";
import { galleryStemFromStoragePath } from "./photo-master";
import { CARD_HEIGHT, CARD_WIDTH, encodeFramedCardImage } from "./image-variants";

const STEM = "1720000000000-12345678-1234-4234-8234-123456789012-g800";
const BASE = "https://x.supabase.co/storage/v1/object/public/veiculos";

test("normalizeCoverFrame limita posição e zoom e troca lixo pelo padrão", () => {
  assert.deepEqual(normalizeCoverFrame(undefined), DEFAULT_COVER_FRAME);
  assert.deepEqual(normalizeCoverFrame({ x: -50, y: 5000, zoom: 9999 }), { x: 0, y: 1000, zoom: COVER_ZOOM_MAX });
  assert.deepEqual(normalizeCoverFrame({ x: "250", y: 333.6, zoom: 10 }), { x: 250, y: 334, zoom: COVER_ZOOM_MIN });
  assert.deepEqual(normalizeCoverFrame({ x: NaN, y: Infinity, zoom: null }), DEFAULT_COVER_FRAME);
  assert.equal(isDefaultCoverFrame({ x: 500, y: 500, zoom: 100 }), true);
  assert.equal(isDefaultCoverFrame({ x: 500, y: 500, zoom: 101 }), false);
});

test("parseCoverFrame só aceita objeto com três números", () => {
  assert.equal(parseCoverFrame(null), null);
  assert.equal(parseCoverFrame({ x: 1, y: 2 }), null);
  assert.equal(parseCoverFrame({ x: "1", y: 2, zoom: 100 }), null);
  assert.deepEqual(parseCoverFrame({ x: 1, y: 2, zoom: 400 }), { x: 1, y: 2, zoom: 300 });
});

test("recorte padrão é o maior 4:3 centralizado, como o card automático", () => {
  // 16:9 largo: corta as laterais
  assert.deepEqual(coverCropRect(1280, 720, DEFAULT_COVER_FRAME), { left: 160, top: 0, width: 960, height: 720 });
  // 4:3 exato: foto inteira
  assert.deepEqual(coverCropRect(1280, 960, DEFAULT_COVER_FRAME), { left: 0, top: 0, width: 1280, height: 960 });
  // retrato: corta em cima e embaixo
  assert.deepEqual(coverCropRect(960, 1280, DEFAULT_COVER_FRAME), { left: 0, top: 280, width: 960, height: 720 });
});

test("posição move a janela só na folga; zoom encolhe a janela", () => {
  const left = coverCropRect(1280, 720, { x: 0, y: 500, zoom: 100 });
  const right = coverCropRect(1280, 720, { x: 1000, y: 500, zoom: 100 });
  assert.equal(left.left, 0);
  assert.equal(right.left + right.width, 1280);
  const zoomed = coverCropRect(1280, 960, { x: 0, y: 1000, zoom: 200 });
  assert.deepEqual(zoomed, { left: 0, top: 480, width: 640, height: 480 });
});

test("recorte sempre cabe na foto e mantém 4:3, mesmo em fotos pequenas ou extremas", () => {
  for (const [w, h] of [[1280, 720], [720, 1280], [1, 1], [3, 2000], [4000, 10], [1280, 960]]) {
    for (const frame of [DEFAULT_COVER_FRAME, { x: 0, y: 0, zoom: 300 }, { x: 1000, y: 1000, zoom: 300 }, { x: 321, y: 777, zoom: 173 }]) {
      const rect = coverCropRect(w, h, frame);
      assert.ok(rect.left >= 0 && rect.top >= 0, `${w}x${h}`);
      assert.ok(rect.left + rect.width <= w && rect.top + rect.height <= h, `${w}x${h} ${JSON.stringify(frame)}`);
      assert.ok(rect.width >= 1 && rect.height >= 1);
      if (rect.width > 20 && rect.height > 20) assert.ok(Math.abs(rect.width / rect.height - 4 / 3) < 0.06, `${w}x${h}`);
    }
  }
});

test("cropToCss e cropToFractions descrevem a mesma janela", () => {
  const rect = coverCropRect(1280, 720, { x: 1000, y: 500, zoom: 200 });
  const css = cropToCss(1280, 720, rect);
  assert.equal(parseFloat(css.width), (1280 / rect.width) * 100);
  assert.ok(parseFloat(css.left) <= 0 && parseFloat(css.top) <= 0);
  const fractions = cropToFractions(1280, 720, rect);
  assert.ok(fractions.left + fractions.width <= 1.000001 && fractions.top + fractions.height <= 1.000001);
  assert.equal(fractions.width, rect.width / 1280);
});

test("zoom mantém o centro da janela e respeita os limites", () => {
  const start = { x: 800, y: 500, zoom: 100 };
  const before = coverCropRect(1280, 720, start);
  const next = zoomCoverFrame(1280, 720, start, 200);
  const after = coverCropRect(1280, 720, next);
  assert.equal(next.zoom, 200);
  assert.ok(Math.abs(before.left + before.width / 2 - (after.left + after.width / 2)) <= 2);
  assert.equal(zoomCoverFrame(1280, 720, start, 5000).zoom, COVER_ZOOM_MAX);
  assert.equal(zoomCoverFrame(1280, 720, next, 1).zoom, COVER_ZOOM_MIN);
  // sem folga vertical (16:9 → altura inteira) a posição vertical anterior é preservada
  assert.equal(zoomCoverFrame(1280, 720, { x: 500, y: 123, zoom: 100 }, 100).y, 123);
});

test("arrastar move a janela em pixels da foto e para nas bordas", () => {
  const start = { x: 500, y: 500, zoom: 200 };
  const rect = coverCropRect(1280, 960, start);
  const moved = panCoverFrame(1280, 960, start, 100, -50);
  const next = coverCropRect(1280, 960, moved);
  assert.ok(Math.abs(next.left - (rect.left + 100)) <= 2);
  assert.ok(Math.abs(next.top - (rect.top - 50)) <= 2);
  assert.deepEqual(panCoverFrame(1280, 960, start, 99999, 99999), { x: 1000, y: 1000, zoom: 200 });
  assert.deepEqual(panCoverFrame(1280, 960, start, -99999, -99999), { x: 0, y: 0, zoom: 200 });
  // zoom 100 em foto 4:3: nada a mover
  assert.deepEqual(panCoverFrame(1280, 960, DEFAULT_COVER_FRAME, 300, 300), DEFAULT_COVER_FRAME);
});

test("nome da miniatura enquadrada carrega o recorte e é único por enquadramento", () => {
  const frame = { x: 120, y: 880, zoom: 175 };
  assert.equal(coverFrameSuffix(frame), "-card-x120y880z175.webp");
  const path = framedCardObjectPath(`${STEM}.webp`, frame);
  assert.equal(path, `${STEM}-card-x120y880z175.webp`);
  assert.notEqual(path, `${STEM}-card.webp`);
  assert.notEqual(path, framedCardObjectPath(`${STEM}.webp`, { ...frame, x: 121 }));
  assert.deepEqual(coverFrameFromCardUrl(`${BASE}/${path}`), frame);
  assert.deepEqual(coverFrameFromCardUrl(`${BASE}/${path}?v=1#x`), frame);
  assert.equal(isFramedCardUrl(`${BASE}/${path}`), true);
});

test("miniatura automática, galeria e nomes malformados não são enquadramento", () => {
  for (const url of [`${BASE}/${STEM}-card.webp`, `${BASE}/${STEM}.webp`, `${BASE}/${STEM}-card-x2000y10z100.webp`, `${BASE}/${STEM}-card-x10y10z999.webp`, `${BASE}/${STEM}-card-x10y10z050.webp`, "", null, undefined]) {
    assert.equal(coverFrameFromCardUrl(url), null, String(url));
  }
});

test("copiar o anúncio leva o enquadramento para o nome novo", () => {
  const source = `${BASE}/${STEM}-card-x300y700z150.webp`;
  assert.equal(cardObjectPathLike(source, "1730000000000-aaaa-bbbb.webp"), "1730000000000-aaaa-bbbb-card-x300y700z150.webp");
  assert.equal(cardObjectPathLike(`${BASE}/${STEM}-card.webp`, "novo.webp"), "novo-card.webp");
  assert.equal(cardObjectPathLike(null, "novo.jpg"), "novo-card.webp");
});

test("só fotos da galeria na raiz do bucket aceitam enquadramento", () => {
  assert.equal(coverFrameSourcePath(`${STEM}.webp`), `${STEM}.webp`);
  assert.equal(coverFrameSourcePath("foto_antiga.JPG"), "foto_antiga.JPG");
  for (const bad of [`${STEM}-card.webp`, `${STEM}-card-x1y1z100.webp`, `${STEM}-preview.webp`, "../x.webp", "a/b.webp", "a\\b.webp", "x.gif", "", null, ".webp"]) {
    assert.equal(coverFrameSourcePath(bad), null, String(bad));
  }
});

async function averageColor(buffer: Buffer) {
  const data = await sharp(buffer).resize(1, 1, { fit: "fill" }).removeAlpha().raw().toBuffer();
  return [...data];
}

test("encodeFramedCardImage gera 480×360 a partir da janela escolhida", async () => {
  // 1280×720: metade esquerda vermelha, direita azul.
  const blue = await sharp({ create: { width: 640, height: 720, channels: 3, background: "#0000ff" } }).png().toBuffer();
  const photo = await sharp({ create: { width: 1280, height: 720, channels: 3, background: "#ff0000" } })
    .composite([{ input: blue, left: 640, top: 0 }])
    .png()
    .toBuffer();
  const left = await encodeFramedCardImage(photo, { x: 0, y: 500, zoom: 100 });
  const right = await encodeFramedCardImage(photo, { x: 1000, y: 500, zoom: 100 });
  const zoomedLeft = await encodeFramedCardImage(photo, { x: 0, y: 0, zoom: 300 });
  const meta = await sharp(left.buffer).metadata();
  assert.equal(meta.format, "webp");
  assert.deepEqual([meta.width, meta.height], [CARD_WIDTH, CARD_HEIGHT]);
  assert.ok((await averageColor(left.buffer))[0] > 150, "janela à esquerda é majoritariamente vermelha");
  assert.ok((await averageColor(right.buffer))[2] > 150, "janela à direita é majoritariamente azul");
  const [r, , b] = await averageColor(zoomedLeft.buffer);
  assert.ok(r > 240 && b < 15, "zoom 300% no canto esquerdo é só vermelho");
});

test("encodeFramedCardImage usa a foto já girada pela orientação EXIF", async () => {
  // Cru 400×200: esquerda vermelha, direita azul. Orientação 6 gira 90° horário:
  // vira 200×400 com vermelho em cima e azul embaixo.
  const blue = await sharp({ create: { width: 200, height: 200, channels: 3, background: "#0000ff" } }).png().toBuffer();
  const raw = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#ff0000" } })
    .composite([{ input: blue, left: 200, top: 0 }])
    .jpeg({ quality: 100 })
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const top = await encodeFramedCardImage(raw, { x: 500, y: 0, zoom: 100 });
  const bottom = await encodeFramedCardImage(raw, { x: 500, y: 1000, zoom: 100 });
  assert.ok((await averageColor(top.buffer))[0] > 200, "topo da foto girada é vermelho");
  assert.ok((await averageColor(bottom.buffer))[2] > 200, "base da foto girada é azul");
});

test("card público usa só o arquivo enquadrado, sem recortes ao vivo centralizados", () => {
  const original = `${BASE}/${STEM}.webp`;
  const framed = `${BASE}/${STEM}-card-x120y880z175.webp`;
  const photos = [{ url: original, thumbnailUrl: framed }];
  assert.equal(coverSrc(photos), framed);
  // sem srcset: o <img> fica só com o src (a miniatura 480×360 gravada), no celular e no desktop
  assert.equal(coverSrcSet(photos), undefined);
  assert.equal(coverMobileSrcSet(photos), undefined);
  // a miniatura automática continua com os recortes de sempre no desktop
  const automatic = [{ url: original, thumbnailUrl: `${BASE}/${STEM}-card.webp` }];
  assert.match(coverSrcSet(automatic) ?? "", /720w/);
});

test("miniatura enquadrada não é tomada por foto de galeria nem tem original privado", () => {
  assert.equal(galleryStemFromStoragePath(`${STEM}-card-x120y880z175.webp`), null);
  assert.equal(galleryStemFromStoragePath(`${STEM}-card.webp`), null);
  assert.ok(galleryStemFromStoragePath(`${STEM}.webp`));
});
