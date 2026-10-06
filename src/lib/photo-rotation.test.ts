import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { rotatePhoto, parsePhotoRotation } from "./photo-rotation";
import { previousObjectPathFromGalleryPath, privatePreviousRefForPublicUrl } from "./photo-master";

test("giro mantém pixels e acompanha a direção da prévia, inclusive com EXIF", async () => {
  const pixels = Buffer.from([255,0,0, 0,255,0, 0,0,255, 255,255,0, 255,0,255, 0,255,255]);
  const image = await sharp(pixels, { raw: { width: 3, height: 2, channels: 3 } }).png().toBuffer();
  const { data, info } = await sharp(await rotatePhoto(image, 90)).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 2); assert.equal(info.height, 3);
  assert.deepEqual([...data.subarray(0, 6)], [255,255,0, 255,0,0]);
  const jpeg = await sharp(image).jpeg({ quality: 93 }).toBuffer();
  const roundTrip = await sharp(await rotatePhoto(jpeg, 90)).rotate(270).raw().toBuffer();
  assert.deepEqual(roundTrip, await sharp(jpeg).raw().toBuffer(), "não reencoda o JPEG antes de girar");
  const oriented = await sharp(image).withMetadata({ orientation: 6 }).toBuffer();
  const expected = await sharp(oriented).autoOrient().png().toBuffer();
  const rotated = await rotatePhoto(oriented, 180);
  const actual = await sharp(rotated).rotate(180).raw().toBuffer();
  assert.deepEqual(actual, await sharp(expected).raw().toBuffer());
});
test("versão anterior tem referência privada própria e não aceita miniatura ou travessia", () => {
  const stem = "1720000000000-12345678-1234-4234-8234-123456789012";
  assert.equal(previousObjectPathFromGalleryPath(`${stem}.webp`), `foto-master/${stem}-previous.jpg`);
  assert.equal(previousObjectPathFromGalleryPath(`${stem}-card.webp`), null);
  assert.equal(previousObjectPathFromGalleryPath("../segredo.jpg"), null);
  assert.equal(privatePreviousRefForPublicUrl(`https://example.supabase.co/storage/v1/object/public/veiculos/${stem}.webp`), `private://documentos/foto-master/${stem}-previous.jpg`);
  for (const invalid of [0, -90, 360, "90", null]) assert.equal(parsePhotoRotation(invalid), null);
});
