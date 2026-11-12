import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@prisma/client";
import sharp from "sharp";
import { GET } from "../app/api/catalog-jpg/[vehicleId]/[photoId]/route";
import { prisma } from "./prisma";
import { PHOTO_BLOB_ORIGIN, PHOTO_STORAGE_ORIGIN } from "./public-photo-url";

const vehicleId = "cmt0ewzpg0000lc0493fl02h7";
const photoId = "photoaaaaaaaaaaaaaaaaaa";
const blob = `${PHOTO_BLOB_ORIGIN}/estoque/carro/foto.webp`;
const storage = `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/foto.webp`;
const request = new Request(`https://site.test/api/catalog-jpg/${vehicleId}/${photoId}`);
const context = { params: Promise.resolve({ vehicleId, photoId }) };

test("catálogo JPG responde 404 para fonte não pública sem download nem fallback", async () => {
  const originalFind = prisma.vehicle.findFirst;
  const originalFetch = globalThis.fetch;
  const previous = process.env.E2E_TEST;
  delete process.env.E2E_TEST;
  try {
    globalThis.fetch = async () => assert.fail("Fonte recusada não pode gerar download");
    for (const url of [storage, "https://cdn.example/foto.webp", blob + "?token=x", "/fotos/v1/original/foto.webp"]) {
      prisma.vehicle.findFirst = (async () => ({ photos: [{ url }] })) as unknown as typeof originalFind;
      const response = await GET(request, context);
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: "Foto não encontrada." });
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("location"), null);
    }
  } finally {
    prisma.vehicle.findFirst = originalFind;
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.E2E_TEST; else process.env.E2E_TEST = previous;
  }
});

test("catálogo JPG responde 404 para parâmetros inválidos e foto ausente", async () => {
  const originalFind = prisma.vehicle.findFirst;
  try {
    prisma.vehicle.findFirst = (async () => assert.fail("Parâmetros inválidos não devem consultar o banco")) as unknown as typeof originalFind;
    for (const params of [{ vehicleId: "invalido", photoId }, { vehicleId, photoId: "invalido" }]) {
      assert.equal((await GET(request, { params: Promise.resolve(params) })).status, 404);
    }
    for (const result of [null, { photos: [] }]) {
      prisma.vehicle.findFirst = (async () => result) as unknown as typeof originalFind;
      assert.equal((await GET(request, context)).status, 404);
    }
  } finally {
    prisma.vehicle.findFirst = originalFind;
  }
});

test("falhas ao buscar ou converter Blob respondem 502 sem cache nem redirect ao original", async () => {
  const originalFind = prisma.vehicle.findFirst;
  const originalFetch = globalThis.fetch;
  const previous = process.env.E2E_TEST;
  delete process.env.E2E_TEST;
  try {
    prisma.vehicle.findFirst = (async () => ({ photos: [{ url: blob }] })) as unknown as typeof originalFind;
    for (const fetcher of [
      async () => { throw new Error("Falha temporária de rede"); },
      async () => new Response(null, { status: 503 }),
      async () => new Response("imagem inválida", { headers: { "Content-Type": "image/webp" } }),
    ]) {
      let calls = 0;
      globalThis.fetch = async (url, options) => {
        calls++;
        assert.equal(url, blob);
        assert.equal(options?.redirect, "error");
        return fetcher();
      };
      const response = await GET(request, context);
      assert.equal(response.status, 502);
      assert.deepEqual(await response.json(), { error: "Não foi possível preparar o JPG." });
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("location"), null);
      assert.equal(calls, 1);
    }
  } finally {
    prisma.vehicle.findFirst = originalFind;
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.E2E_TEST; else process.env.E2E_TEST = previous;
  }
});

test("catálogo JPG entrega JPEG do Blob com cache de CDN e consulta só veículo disponível", async () => {
  const originalFind = prisma.vehicle.findFirst;
  const originalFetch = globalThis.fetch;
  const previous = process.env.E2E_TEST;
  delete process.env.E2E_TEST;
  try {
    prisma.vehicle.findFirst = (async (args?: Prisma.VehicleFindFirstArgs) => {
      assert.deepEqual(args?.where, { id: vehicleId, status: "disponivel", historical: false });
      assert.deepEqual(args?.select?.photos, { where: { id: photoId }, select: { url: true }, take: 1 });
      return { photos: [{ url: blob }] };
    }) as unknown as typeof originalFind;
    const bytes = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "red" } }).webp().toBuffer();
    globalThis.fetch = async () => new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp" } });
    const response = await GET(request, context);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.equal(response.headers.get("content-disposition"), "inline");
    assert.match(response.headers.get("cache-control")!, /s-maxage=86400/);
    const output = Buffer.from(await response.arrayBuffer());
    assert.equal(response.headers.get("content-length"), String(output.byteLength));
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.equal(metadata.width, 1280);
  } finally {
    prisma.vehicle.findFirst = originalFind;
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.E2E_TEST; else process.env.E2E_TEST = previous;
  }
});

test("catálogo JPG usa fixture E2E antes de recusar URL legada do Storage", async () => {
  const originalFind = prisma.vehicle.findFirst;
  const originalFetch = globalThis.fetch;
  const previous = { flag: process.env.E2E_TEST, database: process.env.DATABASE_URL };
  try {
    process.env.E2E_TEST = "1";
    process.env.DATABASE_URL = "postgresql://local:local@127.0.0.1:5432/garagem_e2e";
    prisma.vehicle.findFirst = (async () => ({ photos: [{ url: storage }] })) as unknown as typeof originalFind;
    globalThis.fetch = async () => assert.fail("E2E não pode baixar fotos reais");
    const response = await GET(request, context);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format, "jpeg");
  } finally {
    prisma.vehicle.findFirst = originalFind;
    globalThis.fetch = originalFetch;
    if (previous.flag === undefined) delete process.env.E2E_TEST; else process.env.E2E_TEST = previous.flag;
    if (previous.database === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous.database;
  }
});

test("catálogo JPG converte foto R2 sem habilitar a fixture e mantém a recusa de formas inválidas", async () => {
  const originalFind = prisma.vehicle.findFirst;
  const originalFetch = globalThis.fetch;
  const previous = process.env.E2E_TEST;
  delete process.env.E2E_TEST;
  const r2 = "https://pub-revisao.r2.dev/estoque/foto.webp";
  try {
    const bytes = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: "blue" } }).webp().toBuffer();
    const fetched: string[] = [];
    globalThis.fetch = async (url, options) => {
      fetched.push(String(url));
      assert.equal(options?.redirect, "error");
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp" } });
    };
    prisma.vehicle.findFirst = (async () => ({ photos: [{ url: r2 }] })) as unknown as typeof originalFind;
    const response = await GET(request, context);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.match(response.headers.get("cache-control")!, /s-maxage=86400/);
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format, "jpeg");
    assert.deepEqual(fetched, [r2]);

    globalThis.fetch = async () => assert.fail("Fonte recusada não pode gerar download");
    for (const url of [r2 + "?token=x", "https://pub-revisao.r2.dev.attacker.com/foto.webp", "http://pub-revisao.r2.dev/foto.webp", "https://user:pw@pub-revisao.r2.dev/foto.webp"]) {
      prisma.vehicle.findFirst = (async () => ({ photos: [{ url }] })) as unknown as typeof originalFind;
      assert.equal((await GET(request, context)).status, 404, url);
    }
  } finally {
    prisma.vehicle.findFirst = originalFind;
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.E2E_TEST; else process.env.E2E_TEST = previous;
  }
});

test("catálogo JPG com falha no R2 responde 502 sem segunda busca", async () => {
  const originalFind = prisma.vehicle.findFirst;
  const originalFetch = globalThis.fetch;
  const previous = { flag: process.env.E2E_TEST, r2: process.env.R2_ACCOUNT_ID };
  delete process.env.E2E_TEST;
  delete process.env.R2_ACCOUNT_ID;
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 503 }); };
    prisma.vehicle.findFirst = (async () => ({ photos: [{ url: "https://pub-revisao.r2.dev/foto.webp" }] })) as unknown as typeof originalFind;
    const response = await GET(request, context);
    assert.equal(response.status, 502);
    assert.equal(calls, 1);
  } finally {
    prisma.vehicle.findFirst = originalFind;
    globalThis.fetch = originalFetch;
    if (previous.flag === undefined) delete process.env.E2E_TEST; else process.env.E2E_TEST = previous.flag;
    if (previous.r2 === undefined) delete process.env.R2_ACCOUNT_ID; else process.env.R2_ACCOUNT_ID = previous.r2;
  }
});
