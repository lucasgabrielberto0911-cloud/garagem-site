import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAllowedStorageHost,
  parseStoredFileRef,
  storagePathFromPublicUrl,
} from "./storage-file-ref";

test("storagePathFromPublicUrl aceita hosts Supabase autorizados e caminhos limpos", () => {
  const valid = "https://x.supabase.co/storage/v1/object/public/veiculos/foto123.webp";
  assert.equal(storagePathFromPublicUrl(valid), "foto123.webp");

  const withQuery = "https://x.supabase.co/storage/v1/object/public/veiculos/sub/foto.webp?v=123#preview";
  assert.equal(storagePathFromPublicUrl(withQuery), "sub/foto.webp");
});

test("storagePathFromPublicUrl rejeita loopback, hosts externos e protocolos inseguros", () => {
  // Loopback e IPs locais
  assert.equal(
    storagePathFromPublicUrl("http://localhost:3000/storage/v1/object/public/veiculos/hack.webp"),
    null,
  );
  assert.equal(
    storagePathFromPublicUrl("http://127.0.0.1:8080/storage/v1/object/public/veiculos/hack.webp"),
    null,
  );
  assert.equal(
    storagePathFromPublicUrl("https://127.0.0.1/storage/v1/object/public/veiculos/hack.webp"),
    null,
  );
  assert.equal(
    storagePathFromPublicUrl("http://[::1]/storage/v1/object/public/veiculos/hack.webp"),
    null,
  );
  assert.equal(
    storagePathFromPublicUrl("http://169.254.169.254/storage/v1/object/public/veiculos/hack.webp"),
    null,
  );

  // Host externo com marcador Storage
  assert.equal(
    storagePathFromPublicUrl("https://evil-attacker.com/storage/v1/object/public/veiculos/hack.webp"),
    null,
  );
  assert.equal(
    storagePathFromPublicUrl("http://attacker.org/storage/v1/object/public/veiculos/hack.webp"),
    null,
  );

  // Protocolo inseguro HTTP em host Supabase
  assert.equal(
    storagePathFromPublicUrl("http://x.supabase.co/storage/v1/object/public/veiculos/foto.webp"),
    null,
  );

  // Travessia e caracteres inválidos
  assert.equal(
    storagePathFromPublicUrl("https://x.supabase.co/storage/v1/object/public/veiculos/../hack.webp"),
    null,
  );
  assert.equal(
    storagePathFromPublicUrl("https://x.supabase.co/storage/v1/object/public/veiculos/%"),
    null,
  );
});

test("parseStoredFileRef valida formato de arquivos privados e públicos", () => {
  // Válido privado
  const priv = parseStoredFileRef("private://documentos/contratos/doc1.pdf");
  assert.deepEqual(priv, {
    kind: "private",
    bucket: "documentos",
    path: "contratos/doc1.pdf",
  });

  // Privado com travessia
  assert.equal(parseStoredFileRef("private://documentos/../etc/passwd"), null);
  assert.equal(parseStoredFileRef("private://documentos/"), null);

  // Público válido
  const pub = parseStoredFileRef("https://x.supabase.co/storage/v1/object/public/veiculos/carro.webp");
  assert.deepEqual(pub, {
    kind: "public",
    bucket: "veiculos",
    path: "carro.webp",
    url: "https://x.supabase.co/storage/v1/object/public/veiculos/carro.webp",
  });

  // Público manipulado (loopback ou host externo)
  assert.equal(
    parseStoredFileRef("http://localhost:3000/storage/v1/object/public/veiculos/carro.webp"),
    null,
  );
  assert.equal(
    parseStoredFileRef("https://evil.com/storage/v1/object/public/veiculos/carro.webp"),
    null,
  );
});

test("isAllowedStorageHost filtra corretamente hosts seguros", () => {
  assert.equal(isAllowedStorageHost("x.supabase.co"), true);
  assert.equal(isAllowedStorageHost("sub.x.supabase.co"), true);
  assert.equal(isAllowedStorageHost("pub-1234567890abcdef.r2.dev"), true);
  assert.equal(isAllowedStorageHost("pub-test.r2.dev"), true);
  assert.equal(isAllowedStorageHost("localhost"), false);
  assert.equal(isAllowedStorageHost("127.0.0.1"), false);
  assert.equal(isAllowedStorageHost("evil.com"), false);
  assert.equal(isAllowedStorageHost("evil.supabase.co.attacker.com"), false);
  assert.equal(isAllowedStorageHost("pub-test.r2.dev.attacker.com"), false);
  assert.equal(isAllowedStorageHost("attacker.r2.dev"), false);

  const prevR2 = process.env.R2_PUBLIC_URL;
  try {
    process.env.R2_PUBLIC_URL = "https://fotos.suagaragem.net";
    assert.equal(isAllowedStorageHost("fotos.suagaragem.net"), true);
    assert.equal(isAllowedStorageHost("fotos.suagaragem.net", "443", "https:"), true);
    assert.equal(isAllowedStorageHost("evil.suagaragem.net"), false);
  } finally {
    if (prevR2 === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = prevR2;
  }
});

test("storagePathFromPublicUrl e parseStoredFileRef aceitam URLs do Cloudflare R2", () => {
  const r2Url = "https://pub-1234567890abcdef.r2.dev/1731170000000-uuid.webp";
  assert.equal(storagePathFromPublicUrl(r2Url), "1731170000000-uuid.webp");

  const r2Nested = "https://pub-1234567890abcdef.r2.dev/fotos/carro-card.webp";
  assert.equal(storagePathFromPublicUrl(r2Nested), "fotos/carro-card.webp");

  assert.equal(storagePathFromPublicUrl("https://pub-1234567890abcdef.r2.dev/../hack.webp"), null);
  assert.equal(storagePathFromPublicUrl("http://pub-1234567890abcdef.r2.dev/foto.webp"), null);

  const parsed = parseStoredFileRef(r2Url);
  assert.ok(parsed);
  assert.equal(parsed.kind, "public");
  assert.equal(parsed.path, "1731170000000-uuid.webp");
  assert.equal(parsed.url, r2Url);
});
