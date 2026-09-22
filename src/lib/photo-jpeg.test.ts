import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { DOWNLOAD_JPEG_QUALITY, toDownloadJpeg } from "./photo-jpeg";

test("JPEG de download fica em qualidade 90", () => {
  assert.equal(DOWNLOAD_JPEG_QUALITY, 90);
});

test("webp da galeria vira jpeg no mesmo tamanho", async () => {
  const webp = await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: "#c91418",
    },
  })
    .webp()
    .toBuffer();

  assert.notEqual(webp[0], 0xff);
  const jpeg = await toDownloadJpeg(new Uint8Array(webp));
  assert.equal(jpeg[0], 0xff);
  assert.equal(jpeg[1], 0xd8);
  assert.equal(jpeg[2], 0xff);

  const meta = await sharp(Buffer.from(jpeg)).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 32);
  assert.equal(meta.height, 24);
});

test("jpeg que já está no storage não é reencodado", async () => {
  const jpeg = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 3,
      background: "#111111",
    },
  })
    .jpeg()
    .toBuffer();
  const input = new Uint8Array(jpeg);
  const output = await toDownloadJpeg(input);
  assert.equal(output, input);
});

test("png com transparência vira jpeg", async () => {
  const png = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 10, g: 20, b: 30, alpha: 0.4 },
    },
  })
    .png()
    .toBuffer();
  const jpeg = await toDownloadJpeg(new Uint8Array(png));
  const meta = await sharp(Buffer.from(jpeg)).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.hasAlpha, false);
});

test("rota pública de JPG não fica no prefixo que exclui o sharp", () => {
  const route = join(
    "src/app/api/foto-jpg/[vehicleId]/[photoId]/route.ts",
  );
  assert.equal(existsSync(route), true);
  assert.equal(route.includes(`${join("api", "veiculos")}`), false);
  const config = readFileSync("next.config.mjs", "utf8");
  assert.match(config, /"\/api\/veiculos\/\*\*"/);
  assert.match(config, /foto-jpg/);
});
