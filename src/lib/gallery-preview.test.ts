import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "node:http";
import sharp from "sharp";
import { encodeGalleryPreview } from "./image-variants";
import { galleryPreviewObjectPath, readyGalleryPath } from "./gallery-preview-path";
import { publicPhotoUpstream, PHOTO_STORAGE_ORIGIN } from "./public-photo-url";
import { servePublicPhoto } from "./public-photo-http";
import { masterObjectPathFromGalleryPath, previousObjectPathFromGalleryPath } from "./photo-master";
import { prepareGalleryUploadPath } from "./gallery-preview-store";
import { storeCardThumbnail } from "./photo-thumbnails";
import { deleteStorageFiles } from "./supabase";

const id = "1710000000000-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const path = readyGalleryPath(id);
const R2_KEYS = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_PUBLIC_URL", "R2_API_TOKEN"] as const;

/** Sem isto, R2_* do ambiente (cloud agent / .env) desvia o mock local e pode bater no bucket real. */
function withoutR2<T>(fn: () => Promise<T>): Promise<T> {
  const previous = Object.fromEntries(R2_KEYS.map((key) => [key, process.env[key]]));
  for (const key of R2_KEYS) delete process.env[key];
  return fn().finally(() => {
    for (const key of R2_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
}

test("galeria pronta preserva master privado e não trata derivados como originais", () => {
  assert.equal(galleryPreviewObjectPath(path), `${id}-g800-preview.webp`);
  assert.equal(galleryPreviewObjectPath(`${id}.webp`), null);
  assert.equal(masterObjectPathFromGalleryPath(path), `foto-master/${id}.jpg`);
  assert.equal(previousObjectPathFromGalleryPath(path), `foto-master/${id}-previous.jpg`);
  assert.equal(masterObjectPathFromGalleryPath(galleryPreviewObjectPath(path)!), null);
  assert.equal(masterObjectPathFromGalleryPath(`${id}-g800-card.webp`), null);
});

test("preview mantém 800 px, proporção, orientação e não amplia fotos menores", async () => {
  for (const [width, height] of [[1280, 960], [960, 1280], [480, 360]]) {
    const input = await sharp({ create: { width, height, channels: 3, background: "#c4a080" } }).webp().toBuffer();
    const output = await encodeGalleryPreview(input);
    const meta = await sharp(output.buffer).metadata();
    assert.equal(meta.width, Math.min(800, width));
    assert.ok(Math.abs(meta.height! / meta.width! - height / width) < 0.002);
    assert.equal(meta.format, "webp");
  }
  const rotated = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#888" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const meta = await sharp((await encodeGalleryPreview(rotated)).buffer).metadata();
  assert.equal(meta.width, 800); assert.equal(meta.height, 1200);
});

test("preview legado é identificado, mas não consulta nem recupera Storage publicamente", async () => {
  const parts = ["v1", "800-contain-q80", path];
  assert.equal(publicPhotoUpstream(parts), `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/${id}-g800-preview.webp`);
  for (const method of ["GET", "HEAD"]) {
    let calls = 0;
    const request = new Request(`https://www.suagaragem.net/fotos/${parts.join("/")}`, { method });
    const response = await servePublicPhoto(request, parts, async () => {
      calls++;
      return new Response(null, { status: 402 });
    });
    assert.equal(calls, 0);
    assert.equal(response.status, 410);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(await response.text(), "");
  }
});

test("Storage SDK prepara antes de publicar, tolera falhas e remove derivados; fallback assinado também prepara", async () => withoutR2(async () => {
  const original = await sharp({ create: { width: 1280, height: 960, channels: 3, background: "#124" } }).webp().toBuffer();
  const objects = new Map<string, Buffer>();
  const removed: string[] = [];
  let rejectPreview = false;
  const server = createServer(async (req, res) => {
    const route = req.url!.split("?")[0];
    if (req.method === "GET") { res.setHeader("Content-Type", "image/webp"); res.end(original); return; }
    const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = Buffer.concat(chunks);
    if (req.method === "DELETE") { removed.push(...JSON.parse(body.toString()).prefixes); res.setHeader("Content-Type", "application/json"); res.end("[]"); return; }
    if (rejectPreview && route.endsWith("-preview.webp")) { res.writeHead(500, { "Content-Type": "application/json" }); res.end('{"message":"preview indisponível"}'); return; }
    if (objects.has(route) && req.headers["x-upsert"] !== "true") {
      res.writeHead(409, { "Content-Type": "application/json" }); res.end('{"message":"The resource already exists"}'); return;
    }
    objects.set(route, body);
    assert.equal(req.headers["cache-control"], "max-age=31536000");
    res.setHeader("Content-Type", "application/json"); res.end('{"Key":"veiculos/photo.webp"}');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const before = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-only";
  try {
    assert.equal(await prepareGalleryUploadPath(id, { buffer: original, extension: "webp" }), path);
    assert.equal(await prepareGalleryUploadPath(id, { buffer: original, extension: "webp" }), path);
    const preview = objects.get(`/storage/v1/object/veiculos/${id}-g800-preview.webp`)!;
    assert.equal((await sharp(preview).metadata()).width, 800);
    rejectPreview = true;
    assert.equal(await prepareGalleryUploadPath(id, { buffer: original, extension: "webp" }), `${id}.webp`);
    rejectPreview = false;
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/veiculos/${id}.webp`;
    const ordinary = await storeCardThumbnail(url);
    assert.ok(ordinary.ok); assert.equal(ordinary.url, url);
    const signed = await storeCardThumbnail(url, { prepareGallery: true });
    assert.ok(signed.ok); assert.ok(signed.url!.endsWith(path)); assert.ok(signed.thumbnailUrl!.endsWith(`${id}-g800-card.webp`));
    assert.deepEqual(objects.get(`/storage/v1/object/veiculos/${path}`), original);
    await deleteStorageFiles([signed.url]);
    assert.ok(removed.includes(`${id}-g800-preview.webp`)); assert.ok(removed.includes(path));
  } finally {
    if (before.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = before.url;
    if (before.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = before.key;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}));
