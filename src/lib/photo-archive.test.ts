import assert from "node:assert/strict";
import { test } from "node:test";
import {
  archivePhotoFilename,
  archiveSlug,
  archiveZipFilename,
  extensionFromPhotoUrl,
} from "./photo-archive";

test("slug remove acento e pontuação", () => {
  assert.equal(archiveSlug("Honda Civic"), "honda-civic");
  assert.equal(archiveSlug("Dúvidas / Troca"), "duvidas-troca");
});

test("extensão vem da URL pública, sem query", () => {
  assert.equal(
    extensionFromPhotoUrl(
      "https://x.supabase.co/storage/v1/object/public/veiculos/abc.webp?width=10",
    ),
    "webp",
  );
  assert.equal(extensionFromPhotoUrl("https://cdn.example/foto.JPEG"), "jpg");
  assert.equal(extensionFromPhotoUrl("/branding/placeholder-car.png"), "png");
});

test("nomes do acervo são estáveis e sem espaço", () => {
  assert.equal(
    archivePhotoFilename({
      brand: "Hyundai",
      model: "Creta",
      year: 2022,
      index: 3,
      url: "https://cdn.example/x.webp",
    }),
    "hyundai-creta-2022-03.webp",
  );
  assert.equal(
    archiveZipFilename({ brand: "Hyundai", model: "Creta", year: 2022 }),
    "garagem-hyundai-creta-2022-fotos.zip",
  );
});
