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
  hasHdCardUrl,
  hdCardCompanion,
  isCardVariantPath,
  wantsHdCard,
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
import { uploadFramedCard } from "./framed-card-store";
import type { SupabaseClient } from "@supabase/supabase-js";
import { galleryStemFromStoragePath } from "./photo-master";
import { CARD_HEIGHT, CARD_WIDTH, encodeFramedCardImage, encodeFramedCardSet } from "./image-variants";

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

test("capa enquadrada antiga (só 480) segue sem srcset, no celular e no desktop", () => {
  const original = `${BASE}/${STEM}.webp`;
  const framed = `${BASE}/${STEM}-card-x120y880z175.webp`;
  const photos = [{ url: original, thumbnailUrl: framed }];
  assert.equal(coverSrc(photos), framed);
  assert.equal(coverSrcSet(photos), undefined);
  // o <picture> do celular fica no 480 gravado, nunca no recorte ao vivo centralizado
  assert.equal(coverMobileSrcSet(photos), `${framed} 480w`);
  // a miniatura automática continua com os recortes de sempre no desktop
  const automatic = [{ url: original, thumbnailUrl: `${BASE}/${STEM}-card.webp` }];
  assert.match(coverSrcSet(automatic) ?? "", /720w/);
});

test("capa enquadrada com par 960 usa os dois arquivos gravados; o celular fica no 480", () => {
  const original = `${BASE}/${STEM}.webp`;
  const framed = `${BASE}/${STEM}-card-x120y880z175-hd.webp`;
  const hd = `${BASE}/${STEM}-card-x120y880z175-hd960.webp`;
  const photos = [{ url: original, thumbnailUrl: framed }];
  assert.equal(coverSrc(photos), framed);
  assert.equal(coverSrcSet(photos), `${framed} 480w, ${hd} 960w`);
  assert.equal(coverMobileSrcSet(photos), `${framed} 480w`);
  assert.doesNotMatch(coverSrcSet(photos) ?? "", /render\/image/);
});

test("nomes -hd: o 480 promete o 960, que só existe com o sufixo", () => {
  const path = framedCardObjectPath(`${STEM}.webp`, { x: 10, y: 20, zoom: 130 }, true);
  assert.equal(path, `${STEM}-card-x10y20z130-hd.webp`);
  assert.equal(hdCardCompanion(path), `${STEM}-card-x10y20z130-hd960.webp`);
  assert.equal(hdCardCompanion(`${BASE}/${path}?v=1#x`), `${BASE}/${STEM}-card-x10y20z130-hd960.webp?v=1#x`);
  assert.deepEqual(coverFrameFromCardUrl(`${BASE}/${path}`), { x: 10, y: 20, zoom: 130 });
  assert.equal(hasHdCardUrl(path), true);
  // enquadrada antiga, automática e o próprio 960 não têm par
  for (const none of [`${STEM}-card-x10y20z130.webp`, `${STEM}-card.webp`, `${STEM}.webp`, `${STEM}-card-x10y20z130-hd960.webp`, "", null, undefined]) {
    assert.equal(hdCardCompanion(none), null, String(none));
    assert.equal(hasHdCardUrl(none), false, String(none));
  }
  // o 960 nunca é lido como enquadramento de miniatura (não vai para o banco)
  assert.equal(coverFrameFromCardUrl(`${STEM}-card-x10y20z130-hd960.webp`), null);
});

test("todas as variantes -card são reconhecidas e nenhuma é foto-fonte", () => {
  for (const name of ["-card.webp", "-card-x1y2z100.webp", "-card-x1y2z100-hd.webp", "-card-x1y2z100-hd960.webp"]) {
    assert.equal(isCardVariantPath(`${STEM}${name}`), true, name);
    assert.equal(isCardVariantPath(`${BASE}/${STEM}${name}?v=1`), true, name);
    assert.equal(coverFrameSourcePath(`${STEM}${name}`), null, name);
    assert.equal(galleryStemFromStoragePath(`${STEM}${name}`), null, name);
  }
  assert.equal(isCardVariantPath(`${STEM}.webp`), false);
});

test("cópia do anúncio mantém o -hd só quando o par foi copiado", () => {
  const source = `${BASE}/${STEM}-card-x300y700z150-hd.webp`;
  assert.equal(cardObjectPathLike(source, "novo.webp"), "novo-card-x300y700z150-hd.webp");
  assert.equal(cardObjectPathLike(source, "novo.webp", false), "novo-card-x300y700z150.webp");
  // origem sem par: nunca ganha -hd
  assert.equal(cardObjectPathLike(`${BASE}/${STEM}-card-x300y700z150.webp`, "novo.webp", true), "novo-card-x300y700z150.webp");
  assert.equal(hdCardCompanion(cardObjectPathLike(source, "novo.webp")), "novo-card-x300y700z150-hd960.webp");
});

test("recorte pequeno demais não gera o 960", () => {
  assert.equal(wantsHdCard(coverCropRect(1280, 960, DEFAULT_COVER_FRAME)), true); // 1280
  assert.equal(wantsHdCard(coverCropRect(1280, 720, DEFAULT_COVER_FRAME)), true); // 960
  assert.equal(wantsHdCard(coverCropRect(1280, 960, { ...DEFAULT_COVER_FRAME, zoom: 175 })), true); // 731
  assert.equal(wantsHdCard(coverCropRect(1280, 960, { ...DEFAULT_COVER_FRAME, zoom: 200 })), false); // 640
  // o mesmo zoom no original de 3840 px ainda tem resolução de sobra
  assert.equal(wantsHdCard(coverCropRect(3840, 2880, { ...DEFAULT_COVER_FRAME, zoom: 300 })), true); // 1280
});

async function stripedPhoto(width: number, height: number) {
  const blue = await sharp({ create: { width: width / 2, height, channels: 3, background: "#0000ff" } }).png().toBuffer();
  return sharp({ create: { width, height, channels: 3, background: "#ff0000" } }).composite([{ input: blue, left: width / 2, top: 0 }]).png().toBuffer();
}

test("encodeFramedCardSet: 480 e 960 saem da mesma janela", async () => {
  const photo = await stripedPhoto(1280, 720);
  const { card, hd } = await encodeFramedCardSet(photo, { x: 1000, y: 500, zoom: 100 });
  assert.ok(hd, "janela de 960 px na foto-fonte ganha o par");
  const [cardMeta, hdMeta] = await Promise.all([sharp(card.buffer).metadata(), sharp(hd.buffer).metadata()]);
  assert.deepEqual([cardMeta.width, cardMeta.height, hdMeta.width, hdMeta.height], [CARD_WIDTH, CARD_HEIGHT, 960, 720]);
  assert.equal(hdMeta.format, "webp");
  assert.ok((await averageColor(card.buffer))[2] > 150 && (await averageColor(hd.buffer))[2] > 150, "ambos são a metade azul");
  // o 480 é idêntico ao que encodeFramedCardImage sempre gerou
  assert.deepEqual(card.buffer, (await encodeFramedCardImage(photo, { x: 1000, y: 500, zoom: 100 })).buffer);
});

test("encodeFramedCardSet: foto-fonte pequena não ganha 960 inventado", async () => {
  const photo = await stripedPhoto(640, 480);
  const { card, hd } = await encodeFramedCardSet(photo, { x: 500, y: 500, zoom: 100 });
  assert.equal(hd, null);
  assert.deepEqual([(await sharp(card.buffer).metadata()).width], [CARD_WIDTH]);
});

function fakeStorage(failing: (path: string) => string | null) {
  const saved: string[] = [];
  const client = {
    storage: { from: () => ({ upload: async (path: string) => {
      const message = failing(path);
      if (message) return { error: new Error(message) };
      saved.push(path);
      return { error: null };
    } }) },
  } as unknown as SupabaseClient;
  return { client, saved };
}
const frame = { x: 250, y: 750, zoom: 120 };
const webp = { buffer: Buffer.from("x"), contentType: "image/webp" as const, extension: "webp" as const };

test("uploadFramedCard grava o 960 e o 480 com -hd", async () => {
  const { client, saved } = fakeStorage(() => null);
  const result = await uploadFramedCard(client, `${STEM}.webp`, frame, { card: webp, hd: webp });
  assert.equal(result.error, null);
  assert.equal(result.path, `${STEM}-card-x250y750z120-hd.webp`);
  assert.deepEqual(saved, [`${STEM}-card-x250y750z120-hd960.webp`, `${STEM}-card-x250y750z120-hd.webp`]);
});

test("uploadFramedCard sem 960, ou com o 960 falhando, cai no 480 sem -hd (nunca um -hd sem par)", async () => {
  const noHd = fakeStorage(() => null);
  assert.equal((await uploadFramedCard(noHd.client, `${STEM}.webp`, frame, { card: webp, hd: null })).path, `${STEM}-card-x250y750z120.webp`);
  const failing = fakeStorage(path => (path.endsWith("-hd960.webp") ? "boom" : null));
  const result = await uploadFramedCard(failing.client, `${STEM}.webp`, frame, { card: webp, hd: webp });
  assert.equal(result.error, null);
  assert.equal(result.path, `${STEM}-card-x250y750z120.webp`);
  assert.deepEqual(failing.saved, [`${STEM}-card-x250y750z120.webp`]);
});

test("uploadFramedCard aceita arquivo já existente e devolve a falha do 480", async () => {
  const exists = fakeStorage(() => "The resource already exists");
  const ok = await uploadFramedCard(exists.client, `${STEM}.webp`, frame, { card: webp, hd: webp });
  assert.equal(ok.error, null);
  assert.equal(ok.path, `${STEM}-card-x250y750z120-hd.webp`);
  const broken = fakeStorage(path => (path.endsWith("-hd.webp") ? "sem espaço" : null));
  const failed = await uploadFramedCard(broken.client, `${STEM}.webp`, frame, { card: webp, hd: webp });
  assert.match(failed.error?.message ?? "", /sem espaço/);
});

test("miniatura enquadrada não é tomada por foto de galeria nem tem original privado", () => {
  assert.equal(galleryStemFromStoragePath(`${STEM}-card-x120y880z175.webp`), null);
  assert.equal(galleryStemFromStoragePath(`${STEM}-card.webp`), null);
  assert.ok(galleryStemFromStoragePath(`${STEM}.webp`));
});
