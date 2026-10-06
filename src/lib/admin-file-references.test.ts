import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@prisma/client";
import { adminFileReferences } from "./admin-file-references";

const url = "https://example.supabase.co/storage/v1/object/public/veiculos/1720000000000-12345678-1234-4234-8234-123456789012.webp";
function fixture(photos: { url: string; thumbnailUrl: string | null }[], drafts: { photoUrls: string[] }[] = []) {
  const empty = { findMany: async () => [] };
  return {
    photo: { findMany: async () => photos }, vehicleCost: empty, vehicleDocument: empty,
    testimonial: empty, siteSettings: empty, leadVenda: empty,
    adminDraft: { findMany: async () => drafts },
  } as unknown as Prisma.TransactionClient;
}

test("foto salva e rascunho protegem a versão anterior privada contra limpeza", async () => {
  for (const tx of [fixture([{ url, thumbnailUrl: null }]), fixture([], [{ photoUrls: [url] }])]) {
    const refs = await adminFileReferences(tx);
    assert.ok(refs.publicPaths.has("1720000000000-12345678-1234-4234-8234-123456789012.webp"));
    assert.ok(refs.privatePaths.has("foto-master/1720000000000-12345678-1234-4234-8234-123456789012.jpg"));
    assert.ok(refs.privatePaths.has("foto-master/1720000000000-12345678-1234-4234-8234-123456789012-previous.jpg"));
  }
  assert.equal((await adminFileReferences(fixture([]))).privatePaths.size, 0);
});
test("falha de consulta não trata os arquivos como órfãos", async () => {
  const tx = fixture([]);
  tx.photo.findMany = async () => { throw new Error("banco indisponível"); };
  await assert.rejects(adminFileReferences(tx), /banco indisponível/);
});
