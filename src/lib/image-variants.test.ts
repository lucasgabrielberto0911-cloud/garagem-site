import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { encodeCardImage, encodeGalleryImage } from "./image-variants";

test("capa 4:3 mantém o topo e a base de uma foto na mesma proporção do anúncio", async () => {
  const source = await sharp(Buffer.from('<svg width="800" height="600"><rect width="800" height="600" fill="white"/><rect width="800" height="80" fill="red"/><rect y="520" width="800" height="80" fill="blue"/></svg>')).png().toBuffer();
  const card = await encodeCardImage(source);
  const { data, info } = await sharp(card.buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 480);
  assert.equal(info.height, 360);
  const top = (20 * info.width + 240) * info.channels;
  const bottom = (340 * info.width + 240) * info.channels;
  assert.ok(data[top] > 220 && data[top + 2] < 30, "não corta a faixa superior");
  assert.ok(data[bottom + 2] > 220 && data[bottom] < 30, "não corta a faixa inferior");
});

test("galeria respeita orientação EXIF, limita pixels e não aumenta foto pequena", async () => {
  const small = await sharp({ create: { width: 320, height: 640, channels: 3, background: "#456789" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const oriented = await encodeGalleryImage(small);
  const metadata = await sharp(oriented.buffer).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 640);
  assert.equal(metadata.height, 320);
  const large = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#456789" } }).jpeg().toBuffer();
  const capped = await sharp((await encodeGalleryImage(large)).buffer).metadata();
  assert.equal(capped.width, 1280);
  assert.equal(capped.height, 853);
});
