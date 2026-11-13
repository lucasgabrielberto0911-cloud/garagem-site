import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { E2E_PHOTO_FIXTURE, isE2ePhotoStubUrl } from "./e2e-photo-stub";

test("intercepta rotas de foto do site, da API e do Storage", () => {
  assert.equal(isE2ePhotoStubUrl("http://127.0.0.1:3362/fotos/v1/abc-card.webp"), true);
  assert.equal(isE2ePhotoStubUrl("http://127.0.0.1:3362/api/fotos/v1/abc.webp"), true);
  assert.equal(isE2ePhotoStubUrl("http://127.0.0.1:3362/api/catalog-jpg/v1/abc.jpg"), true);
  assert.equal(
    isE2ePhotoStubUrl("https://xxxx.supabase.co/storage/v1/object/public/veiculos/a.jpg"),
    true,
  );
  assert.equal(
    isE2ePhotoStubUrl("https://abc.public.blob.vercel-storage.com/veiculos/a.jpg"),
    true,
  );
});

test("não intercepta HTML, APIs de dados nem o WhatsApp", () => {
  assert.equal(isE2ePhotoStubUrl("http://127.0.0.1:3362/estoque"), false);
  assert.equal(isE2ePhotoStubUrl("http://127.0.0.1:3362/api/estoque?page=1"), false);
  assert.equal(isE2ePhotoStubUrl("https://wa.me/5527996330706"), false);
});

test("fixture e helper do Playwright existem e são o caminho documentado", () => {
  assert.equal(E2E_PHOTO_FIXTURE, "public/branding/placeholder-car.png");
  assert.match(readFileSync("e2e/stub-fotos.ts", "utf8"), /stubPageFotos/);
  assert.match(readFileSync("e2e/public-journeys.spec.ts", "utf8"), /stubPageFotos/);
  assert.match(readFileSync("docs/E2E-PARA-IAS.md", "utf8"), /stubPageFotos/);
});
