import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { parseStagingPath, publishStagedPhoto, stagingObjectPath, type StagingDeps } from "./upload-staging";

const stem = "1731170000000-0b6f2f0e-1111-4222-8333-444455556666";
const R2 = "https://pub-revisao.r2.dev";

test("caminho temporário só aceita foto-staging/<id>.webp|jpg", () => {
  assert.equal(stagingObjectPath(stem, "webp"), `foto-staging/${stem}.webp`);
  assert.deepEqual(parseStagingPath(`foto-staging/${stem}.jpg`), { stem, extension: "jpg" });
  for (const bad of [`foto-master/${stem}.jpg`, `foto-staging/../x.webp`, `foto-staging/a/${stem}.webp`, `foto-staging/${stem}.png`, "foto-staging/curto.webp", `${stem}.webp`, 42, null]) {
    assert.equal(parseStagingPath(bad), null, String(bad));
  }
});

async function fakes(overrides: Partial<StagingDeps> = {}) {
  const image = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "red" } }).webp().toBuffer();
  const calls = { removed: [] as string[], uploaded: [] as string[] };
  const deps: StagingDeps = {
    download: async () => image,
    remove: async (path) => { calls.removed.push(path); },
    uploadPublic: async (path) => { calls.uploaded.push(path); return `${R2}/${path}`; },
    preparePath: async (id, gallery) => `${id}.${gallery.extension}`,
    ...overrides,
  };
  return { deps, calls };
}

test("publica galeria e capa só no R2 e apaga o temporário privado", async () => {
  const { deps, calls } = await fakes();
  const result = await publishStagedPhoto(`foto-staging/${stem}.webp`, deps, true);
  assert.deepEqual(result, { ok: true, url: `${R2}/${stem}.webp`, thumbnailUrl: `${R2}/${stem}-card.webp` });
  assert.equal(calls.uploaded.length, 2);
  assert.deepEqual(calls.removed, [`foto-staging/${stem}.webp`]);
});

test("falha no R2 não publica URL, responde erro e ainda apaga o temporário", async () => {
  const { deps, calls } = await fakes({ uploadPublic: async () => { throw new Error("R2 fora"); } });
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await publishStagedPhoto(`foto-staging/${stem}.webp`, deps, true);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 500);
  } finally { console.error = originalError; }
  assert.deepEqual(calls.removed, [`foto-staging/${stem}.webp`]);
});

test("R2 incompleto, caminho inválido ou arquivo ausente falham fechado", async () => {
  const { deps, calls } = await fakes();
  const notReady = await publishStagedPhoto(`foto-staging/${stem}.webp`, deps, false);
  assert.equal(notReady.ok === false && notReady.status, 503);
  const invalid = await publishStagedPhoto(`foto-master/${stem}.jpg`, deps, true);
  assert.equal(invalid.ok === false && invalid.status, 400);
  assert.deepEqual(calls.uploaded, []);
  assert.deepEqual(calls.removed, []);

  const missing = await fakes({ download: async () => null });
  const absent = await publishStagedPhoto(`foto-staging/${stem}.webp`, missing.deps, true);
  assert.equal(absent.ok === false && absent.status, 400);
  assert.deepEqual(missing.calls.uploaded, []);

  const garbage = await fakes({ download: async () => Buffer.from("não é imagem") });
  const bad = await publishStagedPhoto(`foto-staging/${stem}.webp`, garbage.deps, true);
  assert.equal(bad.ok === false && bad.status, 400);
  assert.deepEqual(garbage.calls.uploaded, []);
});
