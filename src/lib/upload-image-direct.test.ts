import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadImageDirect } from "./upload-image-direct";

const SUPABASE_PUBLIC = "https://projeto.supabase.co/storage/v1/object/public/veiculos/";
const file = new File([new Uint8Array(10)], "foto.webp", { type: "image/webp" });
const prepare = async (f: File) => f;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function withFetch<T>(handler: (url: string, init?: RequestInit) => Response | Promise<Response>, run: (calls: Array<{ url: string; method: string }>) => Promise<T>) {
  const original = globalThis.fetch;
  const warn = console.warn;
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const calls: Array<{ url: string; method: string }> = [];
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; // força o PUT direto na URL assinada
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  console.warn = () => {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET" });
    return handler(url, init);
  }) as typeof fetch;
  try { return await run(calls); } finally {
    globalThis.fetch = original;
    console.warn = warn;
    if (envUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = envUrl;
    if (envAnon !== undefined) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = envAnon;
  }
}

test("413 com R2 ativo: sobe ao objeto privado, publica no R2 e não toca no bucket público", async () => {
  const handler = (url: string) => {
    if (url === "/api/upload") return json({ error: "grande" }, 413);
    if (url === "/api/upload/sign") return json({ staged: true, path: "foto-staging/abc-12345678.webp", token: "t", signedUrl: "https://projeto.supabase.co/storage/v1/object/upload/sign/documentos/foto-staging/abc-12345678.webp?token=t", contentType: "image/webp" });
    if (url.includes("/object/upload/sign/documentos/")) return new Response("{}", { status: 200 });
    if (url === "/api/upload/publish-staged") return json({ url: "https://pub-revisao.r2.dev/a.webp", thumbnailUrl: "https://pub-revisao.r2.dev/a-card.webp" });
    throw new Error(`chamada inesperada: ${url}`);
  };
  await withFetch(handler, async (calls) => {
    const result = await uploadImageDirect(file, undefined, { prepare });
    assert.deepEqual(result, { url: "https://pub-revisao.r2.dev/a.webp", thumbnailUrl: "https://pub-revisao.r2.dev/a-card.webp" });
    assert.equal(calls.some((c) => c.url.includes("/veiculos/") || c.url === "/api/upload/variants"), false);
  });
});

test("413 com R2 ativo e falha na publicação: erro, sem URL pública nova do Supabase", async () => {
  const handler = (url: string) => {
    if (url === "/api/upload") return json({}, 413);
    if (url === "/api/upload/sign") return json({ staged: true, path: "foto-staging/abc-12345678.webp", token: "t", signedUrl: "https://projeto.supabase.co/storage/v1/object/upload/sign/documentos/foto-staging/abc-12345678.webp?token=t" });
    if (url.includes("/documentos/")) return new Response("{}", { status: 200 });
    if (url === "/api/upload/publish-staged") return json({ error: "R2 fora" }, 500);
    if (url === "/api/upload/variants") return json({}, 503);
    throw new Error(`chamada inesperada: ${url}`);
  };
  await withFetch(handler, async (calls) => {
    await assert.rejects(uploadImageDirect(file, undefined, { prepare }), /R2 fora/);
    assert.equal(calls.some((c) => c.url.includes("/veiculos/")), false);
    assert.equal(calls.some((c) => c.url === "/api/upload/variants"), false);
  });
});

test("413 sem R2 mantém o caminho legado do bucket público com miniatura", async () => {
  const handler = (url: string) => {
    if (url === "/api/upload") return json({}, 413);
    if (url === "/api/upload/sign") return json({ path: "abc-12345678.webp", token: "t", signedUrl: "https://projeto.supabase.co/storage/v1/object/upload/sign/veiculos/abc-12345678.webp?token=t", publicUrl: `${SUPABASE_PUBLIC}abc-12345678.webp`, contentType: "image/webp" });
    if (url.includes("/veiculos/")) return new Response("{}", { status: 200 });
    if (url === "/api/upload/variants") return json({ url: `${SUPABASE_PUBLIC}abc-12345678.webp`, thumbnailUrl: `${SUPABASE_PUBLIC}abc-12345678-card.webp` });
    throw new Error(`chamada inesperada: ${url}`);
  };
  await withFetch(handler, async () => {
    const result = await uploadImageDirect(file, undefined, { prepare });
    assert.equal(result.url, `${SUPABASE_PUBLIC}abc-12345678.webp`);
    assert.equal(result.thumbnailUrl, `${SUPABASE_PUBLIC}abc-12345678-card.webp`);
  });
});
