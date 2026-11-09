import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deleteR2Photo,
  deleteR2Photos,
  downloadR2Photo,
  getR2Config,
  getR2PublicUrl,
  hasR2Config,
  isR2PhotoUrl,
  isR2StorageHost,
  r2KeyFromUrl,
  uploadR2Photo,
} from "./r2-photos";

const TEST_ENV = {
  R2_ACCOUNT_ID: "account-test-123",
  R2_BUCKET: "garagem-estoque",
  R2_PUBLIC_URL: "https://pub-abc123def456.r2.dev",
  R2_API_TOKEN: "token-secret-xyz-never-logged",
};

function withEnv(vars: Partial<Record<string, string | undefined>>, fn: () => void | Promise<void>) {
  return async () => {
    const original: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) {
      original[key] = process.env[key];
      const val = vars[key];
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
    try {
      await fn();
    } finally {
      for (const key of Object.keys(vars)) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    }
  };
}

test(
  "hasR2Config e getR2Config validam presença das variáveis sem logar segredos",
  withEnv({ R2_ACCOUNT_ID: undefined, R2_BUCKET: undefined, R2_PUBLIC_URL: undefined, R2_API_TOKEN: undefined }, () => {
    assert.equal(hasR2Config(), false);
    assert.throws(
      () => getR2Config(),
      /Configuração do Cloudflare R2 incompleta: falta R2_ACCOUNT_ID, R2_BUCKET, R2_PUBLIC_URL, R2_API_TOKEN/,
    );

    // Parcialmente configurado
    process.env.R2_ACCOUNT_ID = "acc";
    process.env.R2_BUCKET = "bucket";
    assert.equal(hasR2Config(), false);
    assert.throws(
      () => getR2Config(),
      /Configuração do Cloudflare R2 incompleta: falta R2_PUBLIC_URL, R2_API_TOKEN/,
    );
  }),
);

test(
  "getR2PublicUrl monta URL pública correta sem barras duplicadas",
  withEnv(TEST_ENV, () => {
    assert.equal(hasR2Config(), true);
    assert.equal(getR2PublicUrl("carro-123.webp"), "https://pub-abc123def456.r2.dev/carro-123.webp");
    assert.equal(getR2PublicUrl("/sub/carro-123.webp"), "https://pub-abc123def456.r2.dev/sub/carro-123.webp");
  }),
);

test(
  "isR2StorageHost e isR2PhotoUrl validam host e protocolo",
  withEnv(TEST_ENV, () => {
    assert.equal(isR2StorageHost("pub-abc123def456.r2.dev"), true);
    assert.equal(isR2StorageHost("pub-qualquer-outro.r2.dev"), true);
    assert.equal(isR2StorageHost("evil.r2.dev"), false);
    assert.equal(isR2StorageHost("pub-abc.r2.dev.attacker.com"), false);
    assert.equal(isR2StorageHost("localhost"), false);

    assert.equal(isR2PhotoUrl("https://pub-abc123def456.r2.dev/foto.webp"), true);
    assert.equal(isR2PhotoUrl("https://pub-xyz.r2.dev/foto.webp"), true);
    assert.equal(isR2PhotoUrl("http://pub-abc123def456.r2.dev/foto.webp"), false);
    assert.equal(isR2PhotoUrl("https://evil.com/foto.webp"), false);
    assert.equal(isR2PhotoUrl(null), false);
    assert.equal(isR2PhotoUrl(""), false);
  }),
);

test(
  "r2KeyFromUrl extrai chave do objeto corretamente",
  withEnv(TEST_ENV, () => {
    assert.equal(r2KeyFromUrl("https://pub-abc123def456.r2.dev/foto123.webp"), "foto123.webp");
    assert.equal(r2KeyFromUrl("https://pub-abc123def456.r2.dev/sub/foto123.webp"), "sub/foto123.webp");
    assert.equal(r2KeyFromUrl("https://pub-abc123def456.r2.dev/foto%20teste.webp"), "foto teste.webp");
    assert.equal(r2KeyFromUrl("https://pub-abc123def456.r2.dev/../hack.webp"), null);
    assert.equal(r2KeyFromUrl("https://evil.com/foto123.webp"), null);
  }),
);

test(
  "uploadR2Photo envia objeto com PUT, cabeçalho de autorização e content-type",
  withEnv(TEST_ENV, async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: unknown = null;

    const mockFetcher: typeof fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedMethod = init?.method ?? "GET";
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      capturedBody = init?.body;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };

    const buffer = Buffer.from("fake-webp-image-bytes");
    const result = await uploadR2Photo("1731170000000-uuid.webp", buffer, "image/webp", mockFetcher);

    assert.equal(
      capturedUrl,
      "https://api.cloudflare.com/client/v4/accounts/account-test-123/r2/buckets/garagem-estoque/objects/1731170000000-uuid.webp",
    );
    assert.equal(capturedMethod, "PUT");
    assert.equal(capturedHeaders["Authorization"], "Bearer token-secret-xyz-never-logged");
    assert.equal(capturedHeaders["Content-Type"], "image/webp");
    assert.equal(capturedBody, buffer);
    assert.equal(result.url, "https://pub-abc123def456.r2.dev/1731170000000-uuid.webp");
    assert.equal(result.key, "1731170000000-uuid.webp");
  }),
);

test(
  "uploadR2Photo rejeita erros da API sem expor token",
  withEnv(TEST_ENV, async () => {
    const mockFetcher: typeof fetch = async () => {
      return new Response("bucket quota exceeded", { status: 400, statusText: "Bad Request" });
    };

    await assert.rejects(
      async () => uploadR2Photo("foto.webp", Buffer.from("data"), "image/webp", mockFetcher),
      (err: Error) => {
        assert.ok(!err.message.includes("token-secret-xyz-never-logged"));
        assert.ok(err.message.includes("Falha no upload para R2 (400)"));
        return true;
      },
    );
  }),
);

test(
  "deleteR2Photo e deleteR2Photos executam DELETE para o endpoint do R2",
  withEnv(TEST_ENV, async () => {
    const deletedUrls: string[] = [];
    const mockFetcher: typeof fetch = async (input, init) => {
      if (init?.method === "DELETE") {
        deletedUrls.push(String(input));
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    };

    const single = await deleteR2Photo("foto1.webp", mockFetcher);
    assert.equal(single, true);
    assert.equal(
      deletedUrls[0],
      "https://api.cloudflare.com/client/v4/accounts/account-test-123/r2/buckets/garagem-estoque/objects/foto1.webp",
    );

    deletedUrls.length = 0;
    await deleteR2Photos(["a.webp", "b.webp"], mockFetcher);
    assert.equal(deletedUrls.length, 2);
    assert.ok(deletedUrls[0].endsWith("/objects/a.webp"));
    assert.ok(deletedUrls[1].endsWith("/objects/b.webp"));
  }),
);

test(
  "downloadR2Photo tenta URL pública e faz fallback para API autenticada",
  withEnv(TEST_ENV, async () => {
    const bytes = Buffer.from("image-content-bytes");

    // 1. Sucesso na URL pública
    const fetchPublic: typeof fetch = async (input) => {
      if (String(input).includes("pub-abc123def456.r2.dev")) {
        return new Response(bytes, { status: 200 });
      }
      return new Response(null, { status: 404 });
    };
    const res1 = await downloadR2Photo("https://pub-abc123def456.r2.dev/foto.webp", fetchPublic);
    assert.ok(res1);
    assert.deepEqual(res1, bytes);

    // 2. Falha na URL pública -> fallback para API autenticada
    const fetchFallback: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.includes("pub-abc123def456.r2.dev")) {
        return new Response(null, { status: 404 });
      }
      if (url.includes("api.cloudflare.com") && init?.headers && (init.headers as Record<string, string>)["Authorization"]) {
        return new Response(bytes, { status: 200 });
      }
      return new Response(null, { status: 500 });
    };
    const res2 = await downloadR2Photo("foto.webp", fetchFallback);
    assert.ok(res2);
    assert.deepEqual(res2, bytes);

    // 3. Chave maliciosa devolve null
    assert.equal(await downloadR2Photo("../secret.txt", fetchFallback), null);
  }),
);
