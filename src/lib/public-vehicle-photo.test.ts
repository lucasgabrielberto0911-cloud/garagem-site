import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { publicVehiclePhotoSrc, publicPhotoSrc, publicPhotoSrcSet, PHOTO_STORAGE_ORIGIN, VEHICLE_PHOTO_VARIANT } from "./public-photo-url";
import { servePublicPhoto } from "./public-photo-http";
import { e2ePhotoFixture } from "./e2e-photo-fixture";
import { loadArchiveOriginal } from "./photo-archive-download";
import { toCatalogJpeg } from "./photo-jpeg";

const source = `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/camera.jpg`;
const reduced = `/fotos/v1/${VEHICLE_PHOTO_VARIANT}/camera.jpg`;

test("veículos e fallback usam cópia limitada; URL genérica e miniatura preservam sua função", () => {
  assert.equal(publicVehiclePhotoSrc(source), reduced);
  assert.equal(publicVehiclePhotoSrc("https://www.suagaragem.net/fotos/v1/original/camera.jpg"), "https://www.suagaragem.net" + reduced);
  assert.equal(publicPhotoSrc(source), "/fotos/v1/original/camera.jpg");
  assert.equal(publicVehiclePhotoSrc(source.replace("camera.jpg", "camera-card.webp")), "/fotos/v1/original/camera-card.webp");
  assert.equal(publicPhotoSrcSet(`${source} 1280w`, publicVehiclePhotoSrc), `${reduced} 1280w`);
});

test("foto de câmera sai em WebP e JPEG com no máximo 1280 px, sem ampliar pequenas", async () => {
  for (const [width, height] of [[2400, 1600], [1600, 2400], [32, 24]]) {
    const input = await sharp({ create: { width, height, channels: 3, background: "#ed1122" } }).jpeg().toBuffer();
    let calls = 0;
    const response = await servePublicPhoto(new Request("https://site.test" + reduced), ["v1", VEHICLE_PHOTO_VARIANT, "camera.jpg"], async url => {
      calls++;
      assert.equal(url, source);
      return new Response(new Uint8Array(input), { headers: { "Content-Type": "image/jpeg" } });
    });
    assert.equal(calls, 1);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.match(response.headers.get("vercel-cdn-cache-control")!, /s-maxage=31536000/);
    for (const [format, output] of [["webp", Buffer.from(await response.arrayBuffer())], ["jpeg", Buffer.from(await toCatalogJpeg(input))]] as const) {
      const meta = await sharp(output).metadata();
      assert.equal(meta.format, format);
      assert.ok(meta.width! <= Math.min(width, 1280));
      assert.ok(meta.height! <= Math.min(height, 1280));
    }
  }
});

test("transformação inválida ou fonte acima de 15 MB não entrega original nem entra no cache", async () => {
  for (const input of [new Uint8Array(15 * 1024 * 1024 + 1), new Uint8Array([1, 2, 3])]) {
    const response = await servePublicPhoto(new Request("https://site.test" + reduced), ["v1", VEHICLE_PHOTO_VARIANT, "camera.jpg"], async () => new Response(input, { headers: { "Content-Type": "image/jpeg" } }));
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("vercel-cdn-cache-control"), null);
  }
});

test("E2E atende fetch do servidor com fixture e bloqueia banco externo antes do download", async () => {
  const previous = { flag: process.env.E2E_TEST, database: process.env.DATABASE_URL };
  try {
    process.env.E2E_TEST = "1";
    process.env.DATABASE_URL = "postgresql://local:local@127.0.0.1:5549/ci";
    const response = await servePublicPhoto(new Request("https://site.test/fotos/v1/original/camera.jpg"), ["v1", "original", "camera.jpg"], async () => { throw Error("Storage proibido"); });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await e2ePhotoFixture());
    assert.equal((await loadArchiveOriginal(source))?.contentType, "image/png");
    process.env.DATABASE_URL = "postgresql://invalid:invalid@banco.example/ci";
    await assert.rejects(e2ePhotoFixture(), /acesso ao Storage bloqueado/);
    const blocked = await servePublicPhoto(new Request("https://site.test" + reduced), ["v1", VEHICLE_PHOTO_VARIANT, "camera.jpg"], async () => { throw Error("Storage proibido"); });
    assert.equal(blocked.status, 502);
  } finally {
    if (previous.flag === undefined) delete process.env.E2E_TEST; else process.env.E2E_TEST = previous.flag;
    if (previous.database === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous.database;
  }
});
