import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import {
  ADMIN_JPEG_QUALITY,
  DOWNLOAD_JPEG_QUALITY,
  encodeMasterJpeg,
  toDownloadJpeg,
} from "./photo-jpeg";
import {
  createPhotoMasterId,
  galleryStemFromStoragePath,
  isPhotoMasterId,
  masterObjectPathFromGalleryPath,
  masterObjectPathFromId,
  privateMasterRefForPublicUrl,
} from "./photo-master";

const ID = "1710000000000-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const PUBLIC = `https://x.supabase.co/storage/v1/object/public/veiculos/${ID}.webp`;

test("alta do admin é JPEG 93 e a ficha pública continua em 90", () => {
  assert.equal(ADMIN_JPEG_QUALITY, 93);
  assert.equal(DOWNLOAD_JPEG_QUALITY, 90);
  assert.equal(ADMIN_JPEG_QUALITY >= 92 && ADMIN_JPEG_QUALITY <= 95, true);
});

test("id do master não aceita caminho nem travessia", () => {
  const id = createPhotoMasterId();
  assert.equal(isPhotoMasterId(id), true);
  assert.equal(isPhotoMasterId(ID), true);
  assert.equal(isPhotoMasterId("../segredo"), false);
  assert.equal(isPhotoMasterId(`${ID}.jpg`), false);
  assert.equal(isPhotoMasterId(`foto-master/${ID}`), false);
  assert.equal(masterObjectPathFromId(ID), `foto-master/${ID}.jpg`);
  assert.equal(masterObjectPathFromId("../segredo"), null);
});

test("master privado sai do nome da galeria e nunca da miniatura", () => {
  assert.equal(galleryStemFromStoragePath(`${ID}.webp`), ID);
  assert.equal(galleryStemFromStoragePath(`pasta/${ID}.webp`), ID);
  assert.equal(masterObjectPathFromGalleryPath(`${ID}.webp`), `foto-master/${ID}.jpg`);
  assert.equal(galleryStemFromStoragePath(`${ID}-card.webp`), null);
  assert.equal(masterObjectPathFromGalleryPath(`${ID}-card.webp`), null);
  assert.equal(galleryStemFromStoragePath(`../${ID}.webp`), null);
  assert.equal(galleryStemFromStoragePath(`${ID}/../segredo.webp`), null);
});

test("ref do master é privada e não é URL pública do Storage", () => {
  const ref = privateMasterRefForPublicUrl(PUBLIC);
  assert.equal(ref, `private://documentos/foto-master/${ID}.jpg`);
  assert.equal(ref?.includes("/storage/v1/object/public/"), false);
  assert.equal(
    privateMasterRefForPublicUrl(
      `https://x.supabase.co/storage/v1/render/image/public/veiculos/${ID}.webp?width=1280`,
    ),
    `private://documentos/foto-master/${ID}.jpg`,
  );
  assert.equal(privateMasterRefForPublicUrl(`${PUBLIC.replace(".webp", "-card.webp")}`), null);
  assert.equal(privateMasterRefForPublicUrl("https://evil.test/foto.webp"), null);
  assert.equal(privateMasterRefForPublicUrl(""), null);
});

test("JPEG de alta não reduz o lado maior", async () => {
  const webp = await sharp({
    create: {
      width: 1600,
      height: 900,
      channels: 3,
      background: "#224466",
    },
  })
    .webp()
    .toBuffer();

  const jpeg = await encodeMasterJpeg(new Uint8Array(webp));
  const meta = await sharp(Buffer.from(jpeg)).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 900);

  const download = await toDownloadJpeg(new Uint8Array(webp), ADMIN_JPEG_QUALITY);
  const downloadMeta = await sharp(Buffer.from(download)).metadata();
  assert.equal(downloadMeta.width, 1600);
  assert.equal(downloadMeta.height, 900);
});

test("JPEG já gravado passa direto, mesmo pedindo qualidade 93", async () => {
  const jpeg = await sharp({
    create: {
      width: 12,
      height: 8,
      channels: 3,
      background: "#abcdef",
    },
  })
    .jpeg({ quality: 92 })
    .toBuffer();
  const input = new Uint8Array(jpeg);
  const output = await toDownloadJpeg(input, ADMIN_JPEG_QUALITY);
  assert.equal(output, input);
});

test("público fica leve e só o admin lê o master", () => {
  const pub = readFileSync(
    "src/app/api/foto-jpg/[vehicleId]/[photoId]/route.ts",
    "utf8",
  );
  assert.match(pub, /loadGalleryJpeg/);
  assert.equal(pub.includes("loadAdminJpeg"), false);

  for (const route of [
    "src/app/api/admin/fotos/jpg/route.ts",
    "src/app/api/admin/veiculos/[id]/fotos/route.ts",
    "src/app/api/admin/veiculos/[id]/fotos/[photoId]/route.ts",
  ]) {
    const source = readFileSync(route, "utf8");
    assert.match(source, /getSession/);
    assert.match(source, /loadAdminJpeg/);
    assert.equal(source.includes("loadGalleryJpeg"), false);
  }

  const sign = readFileSync("src/app/api/upload/master/sign/route.ts", "utf8");
  assert.match(sign, /getSession/);
  assert.match(sign, /VEHICLE_DOCS_BUCKET/);
  assert.equal(sign.includes("getPublicUrl"), false);

  const sell = readFileSync("src/components/site/SellForm.tsx", "utf8");
  assert.equal(sell.includes("prepareMasterForUpload"), false);
  assert.equal(sell.includes("master: true"), false);
});
