import assert from "node:assert/strict";
import { test } from "node:test";
import { PHOTO_BLOB_ORIGIN, PHOTO_STORAGE_ORIGIN } from "./public-photo-url";
import { isPublicPhotoSource, isPublicR2Photo } from "./public-photo-source";

const r2 = "https://pub-revisao.r2.dev";

test("fonte pública aceita Blob da loja e R2, com as mesmas restrições de forma", () => {
  assert.equal(isPublicPhotoSource(`${PHOTO_BLOB_ORIGIN}/estoque/foto.webp`), true);
  assert.equal(isPublicPhotoSource(`${r2}/1731170000000-uuid.webp`), true);
  assert.equal(isPublicPhotoSource(`${r2}/pasta/foto-card.webp`), true);
});

test("fonte pública recusa Storage, hosts externos e URLs com credencial, query, hash ou porta", () => {
  for (const url of [
    `${PHOTO_STORAGE_ORIGIN}/storage/v1/object/public/veiculos/foto.webp`,
    "https://cdn.example/foto.webp",
    "https://pub-revisao.r2.dev.attacker.com/foto.webp",
    "https://attacker.r2.dev/foto.webp",
    "http://pub-revisao.r2.dev/foto.webp",
    "https://user:pass@pub-revisao.r2.dev/foto.webp",
    `${r2}/foto.webp?token=x`,
    `${r2}/foto.webp#x`,
    "https://pub-revisao.r2.dev:8443/foto.webp",
    `${r2}/foto.txt`,
    `${r2}/`,
    "/fotos/v1/original/foto.webp",
    "",
  ]) {
    assert.equal(isPublicPhotoSource(url), false, url);
  }
});

test("domínio customizado em R2_PUBLIC_URL conta como R2", () => {
  const previous = process.env.R2_PUBLIC_URL;
  try {
    process.env.R2_PUBLIC_URL = "https://fotos.suagaragem.net";
    assert.equal(isPublicR2Photo("https://fotos.suagaragem.net/a/foto.webp"), true);
    assert.equal(isPublicR2Photo("https://outro.suagaragem.net/a/foto.webp"), false);
  } finally {
    if (previous === undefined) delete process.env.R2_PUBLIC_URL; else process.env.R2_PUBLIC_URL = previous;
  }
});
