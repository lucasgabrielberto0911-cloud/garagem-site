import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../app/api/fotos/[id]/zoom/route";
import { prisma } from "./prisma";
import { PHOTO_BLOB_ORIGIN, PHOTO_STORAGE_ORIGIN } from "./public-photo-url";

const id = "cmt0ewzpg0000lc0493fl02h7";
const request = new Request(`https://site.test/api/fotos/${id}/zoom`);
const context = { params: Promise.resolve({ id }) };

async function zoomFor(url: string | null) {
  const original = prisma.photo.findFirst;
  prisma.photo.findFirst = (async () => (url === null ? null : { url })) as unknown as typeof original;
  try { return await GET(request, context); } finally { prisma.photo.findFirst = original; }
}

test("zoom redireciona foto pública do Blob e do R2 para a própria URL", async () => {
  for (const url of [`${PHOTO_BLOB_ORIGIN}/estoque/foto.webp`, "https://pub-revisao.r2.dev/1731170000000-uuid.webp"]) {
    const response = await zoomFor(url);
    assert.equal(response.status, 307, url);
    assert.equal(response.headers.get("location"), url);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("zoom segue sem redirecionar para Storage legado, host externo ou R2 com forma inválida", async () => {
  for (const url of [
    `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/foto.webp`,
    "https://cdn.example/foto.webp",
    "https://pub-revisao.r2.dev/foto.webp?token=x",
    "https://pub-revisao.r2.dev.attacker.com/foto.webp",
  ]) {
    const response = await zoomFor(url);
    assert.equal(response.status, 204, url);
    assert.equal(response.headers.get("location"), null);
  }
  assert.equal((await zoomFor(null)).status, 404);
});
