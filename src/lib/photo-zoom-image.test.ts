import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { encodeZoomImage, ZOOM_MAX_BYTES, ZOOM_MAX_EDGE } from "./photo-zoom-image";
import { ownGalleryPath, zoomObjectPath } from "./photo-zoom-path";
import { blurImageRegions } from "./blur-region";

test("zoom não aumenta fotos pequenas, limita bytes/pixels e remove metadados", async () => {
  const small = await sharp({ create: { width: 1280, height: 960, channels: 3, background: "#789abc" } }).jpeg().toBuffer();
  assert.equal(await encodeZoomImage(small), null);
  const big = await sharp({ create: { width: 3000, height: 1800, channels: 3, background: "#789abc" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const bytes = await encodeZoomImage(big);
  assert.ok(bytes && bytes.length <= ZOOM_MAX_BYTES);
  const info = await sharp(bytes!).metadata();
  assert.equal(info.format, "webp");
  assert.equal(Math.max(info.width!, info.height!), ZOOM_MAX_EDGE);
  assert.ok(info.height! > info.width!);
  assert.equal(info.exif, undefined);
});
test("cópia maior preserva a região borrada da fonte aprovada", async () => {
  const svg = '<svg width="2400" height="1600"><rect width="2400" height="1600" fill="white"/><g fill="black">' + Array.from({ length: 20 }, (_, i) => '<rect x="' + (800 + i * 24) + '" y="1000" width="12" height="100"/>').join("") + "</g></svg>";
  const original = await sharp(Buffer.from(svg)).png().toBuffer();
  const blurred = await blurImageRegions(original, [{ x: .3, y: .6, width: .3, height: .15 }]);
  const zoom = await encodeZoomImage(blurred);
  const { data, info } = await sharp(zoom!).raw().toBuffer({ resolveWithObject: true });
  const values: number[] = [];
  const y = Math.round(info.height * .656);
  for (let x = Math.round(info.width * .36); x < info.width * .5; x++) values.push(data[(y * info.width + x) * info.channels]);
  assert.ok(Math.max(...values) - Math.min(...values) < 90, "não recria o contraste das letras/placa");
});
test("não aceita origem externa, traversal, miniatura, zoom ou ref privada", () => {
  const base = "https://project.supabase.co";
  const gallery = "1790000000000-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.webp";
  assert.equal(ownGalleryPath(base + "/storage/v1/object/public/veiculos/" + gallery, base), gallery);
  assert.equal(zoomObjectPath(gallery), gallery.replace(".webp", "-zoom.webp"));
  for (const url of ["https://evil.test/storage/v1/object/public/veiculos/" + gallery, base + "/storage/v1/object/public/veiculos/%2e%2e%2fx.jpg", "private://documentos/foto-master/x.jpg", base + "/storage/v1/object/public/veiculos/" + gallery + "?q=1"]) assert.equal(ownGalleryPath(url, base), null);
  assert.equal(zoomObjectPath(gallery.replace(".webp", "-card.webp")), null);
  assert.equal(zoomObjectPath(gallery.replace(".webp", "-zoom.webp")), null);
});
