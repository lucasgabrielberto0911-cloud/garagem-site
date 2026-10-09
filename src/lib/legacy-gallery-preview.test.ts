import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { backfillLegacyGallery, legacyGalleryPlan, type LegacyGalleryIO } from "./legacy-gallery-preview";
import { PHOTO_STORAGE_ORIGIN, publicPhotoUpstream } from "./public-photo-url";
import { masterObjectPathFromGalleryPath } from "./photo-master";

const path = "1710000000000-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";
const url = `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/${path}`;
const photo = { id: "local-photo", vehicleId: "local-vehicle", url };

test("lote só aceita originais do bucket e mantém a identidade do master", () => {
  const plan = legacyGalleryPlan(url)!;
  assert.equal(masterObjectPathFromGalleryPath(plan.sourcePath), masterObjectPathFromGalleryPath(plan.galleryPath));
  assert.match(publicPhotoUpstream(["v1", "800-contain-q80", plan.galleryPath])!, /object\/public\/veiculos\/.*-g800-preview.webp$/);
  assert.ok(legacyGalleryPlan(url.replace(".jpg", ".png")));
  for (const bad of [url.replace(".jpg", "-card.webp"), url.replace(".jpg", "-preview.webp"), plan.galleryUrl, url + "?download=1", url.replace(PHOTO_STORAGE_ORIGIN, "https://other.test"), url.replace("/veiculos/", "/documentos/"), url.replace(path, "../private.jpg")]) assert.equal(legacyGalleryPlan(bad), null, bad);
});

test("lote prepara preview, preserva bytes da galeria e registra antes de trocar URL", async () => {
  const original = await sharp({ create: { width: 1280, height: 960, channels: 3, background: "#4a8" } }).jpeg().toBuffer();
  const objects = new Map([[path, original]]);
  const events: string[] = [];
  let current = url;
  const result = await backfillLegacyGallery(photo, {
    read: async key => objects.get(key)!,
    put: async (key, bytes) => { events.push("put"); assert.equal(objects.has(key), false); objects.set(key, bytes); },
    journal: async receipt => { events.push("journal"); assert.equal(receipt.url, url); },
    replace: async (_id, before, next) => { events.push("replace"); assert.equal(before, current); current = next; return true; },
  });
  assert.equal(result.status, "updated");
  assert.deepEqual(events, ["put", "put", "journal", "replace"]);
  const plan = legacyGalleryPlan(url)!;
  assert.deepEqual(objects.get(path), original);
  assert.deepEqual(objects.get(plan.galleryPath), original);
  const preview = await sharp(objects.get(plan.previewPath)).metadata();
  assert.equal(preview.width, 800); assert.equal(preview.height, 600); assert.equal(preview.format, "webp");
  assert.equal(current, plan.galleryUrl);
});

test("falhas de leitura, upload, relatório ou concorrência não sobrescrevem foto editada", async () => {
  const original = await sharp({ create: { width: 480, height: 360, channels: 3, background: "#456" } }).webp().toBuffer();
  for (const failing of ["read", "preview", "gallery", "journal"]) {
    let replaced = false, uploads = 0;
    const io: LegacyGalleryIO = {
      read: async () => { if (failing === "read") throw Error("offline"); return original; },
      put: async () => { if (++uploads === (failing === "preview" ? 1 : failing === "gallery" ? 2 : 0)) throw Error("offline"); },
      journal: async () => { if (failing === "journal") throw Error("disk"); },
      replace: async () => { replaced = true; return true; },
    };
    await assert.rejects(backfillLegacyGallery(photo, io));
    assert.equal(replaced, false);
  }
  let calls = 0;
  const result = await backfillLegacyGallery(photo, { read: async () => original, put: async () => {}, journal: async () => {}, replace: async () => { calls++; return false; } });
  assert.equal(result.status, "superseded"); assert.equal(calls, 1);
  assert.equal((await backfillLegacyGallery({ ...photo, url: legacyGalleryPlan(url)!.galleryUrl }, { read: async () => { throw Error("must not download"); }, put: async () => {}, journal: async () => {}, replace: async () => false })).status, "skipped");
});
