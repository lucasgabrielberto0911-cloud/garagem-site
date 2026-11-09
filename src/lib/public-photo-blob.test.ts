import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { isPublicPhotoBlob, PHOTO_BLOB_ORIGIN } from "./public-photo-url";
import { loadCatalogJpeg } from "./photo-archive-download";
import { prisma } from "./prisma";
import { GET as zoom } from "../app/api/fotos/[id]/zoom/route";

const blob = PHOTO_BLOB_ORIGIN + "/estoque/carro/foto.webp";
const storage = "https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/foto.webp";

test("catálogo converte WebP do Blob e recusa Storage, redirecionamentos e fontes arbitrárias", async () => {
  const originalFetch = globalThis.fetch;
  const previous = process.env.E2E_TEST;
  delete process.env.E2E_TEST;
  try {
    let calls = 0;
    const bytes = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "red" } }).webp().toBuffer();
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, blob);
      assert.equal(options?.redirect, "error");
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp" } });
    };
    for (const forbidden of [storage, "/fotos/v1/original/foto.webp", "https://evil.test/foto.webp", blob.replace("https:", "http:"), blob + "?token=x"]) {
      assert.equal(await loadCatalogJpeg(forbidden), null);
      assert.equal(isPublicPhotoBlob(forbidden), false);
    }
    assert.equal(calls, 0);
    const jpg = await loadCatalogJpeg(blob);
    assert.ok(jpg);
    const metadata = await sharp(jpg).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, 1280);
    assert.equal(calls, 1);
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: storage } });
    assert.equal(await loadCatalogJpeg(blob), null);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.E2E_TEST; else process.env.E2E_TEST = previous;
  }
});

test("zoom usa apenas Blob publicado e não baixa nem gera cópia no Storage", async () => {
  const originalFind = prisma.photo.findFirst;
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => assert.fail("Zoom não deve baixar arquivos no servidor");
    for (const url of [blob, storage, "https://evil.test/foto.webp"]) {
      prisma.photo.findFirst = (async () => ({ url })) as typeof originalFind;
      const response = await zoom(new Request("https://site.test/api/fotos/cmufpkghk000bi304btj4ty52/zoom"), {
        params: Promise.resolve({ id: "cmufpkghk000bi304btj4ty52" }),
      });
      assert.equal(response.status, url === blob ? 307 : 204);
      assert.equal(response.headers.get("location"), url === blob ? blob : null);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  } finally {
    prisma.photo.findFirst = originalFind;
    globalThis.fetch = originalFetch;
  }
});
