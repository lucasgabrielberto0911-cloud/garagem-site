import assert from "node:assert/strict";
import { test } from "node:test";
import {
  adminStorageJpgPath,
  archivePhotoFilename,
  archiveSlug,
  archiveZipFilename,
  extensionFromPhotoUrl,
  publicPhotoJpgPath,
  safeJpgDownloadName,
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
    "hyundai-creta-2022-03.jpg",
  );
  assert.equal(
    archivePhotoFilename({
      brand: "Fiat",
      model: "Argo",
      year: 2021,
      index: 1,
      url: "/branding/placeholder-car.png",
    }),
    "fiat-argo-2021-01.jpg",
  );
  assert.equal(
    safeJpgDownloadName("../../etc/passwd"),
    "passwd.jpg",
  );
  assert.equal(safeJpgDownloadName("foto.webp"), "foto.jpg");
  assert.equal(safeJpgDownloadName(""), "foto.jpg");
  assert.equal(
    publicPhotoJpgPath("cabc123", "cdef456"),
    "/api/foto-jpg/cabc123/cdef456",
  );
  assert.match(adminStorageJpgPath("https://cdn.example/a.webp", "argo-01.jpg"), /name=/);
  assert.equal(
    archiveZipFilename({ brand: "Hyundai", model: "Creta", year: 2022 }),
    "garagem-hyundai-creta-2022-fotos.zip",
  );
});
