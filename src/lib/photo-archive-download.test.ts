import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachmentHeaders,
  isSafeVehicleStoragePath,
  vehiclePhotoStoragePath,
} from "./photo-archive-download";

const OBJECT =
  "https://x.supabase.co/storage/v1/object/public/veiculos/pasta/foto.webp";

test("path do bucket ignora query e recorte do Storage", () => {
  assert.equal(
    vehiclePhotoStoragePath(`${OBJECT}?t=1`),
    "pasta/foto.webp",
  );
  assert.equal(
    vehiclePhotoStoragePath(
      "https://x.supabase.co/storage/v1/render/image/public/veiculos/pasta/foto.webp?width=480&height=300",
    ),
    "pasta/foto.webp",
  );
});

test("path rejeita travessia e URL que não é do bucket de fotos", () => {
  assert.equal(
    vehiclePhotoStoragePath(
      "https://x.supabase.co/storage/v1/object/public/veiculos/../segredo.webp",
    ),
    null,
  );
  assert.equal(
    vehiclePhotoStoragePath(
      "https://x.supabase.co/storage/v1/object/public/veiculos/%2e%2e/segredo.webp",
    ),
    null,
  );
  assert.equal(vehiclePhotoStoragePath("https://evil.test/foto.webp"), null);
  assert.equal(vehiclePhotoStoragePath(""), null);
  assert.equal(
    vehiclePhotoStoragePath(
      "https://x.supabase.co/storage/v1/object/public/veiculos/%",
    ),
    null,
  );
  assert.equal(isSafeVehicleStoragePath("pasta/foto.webp"), true);
  assert.equal(isSafeVehicleStoragePath("../foto.webp"), false);
});

test("anexo do download é jpeg com nome .jpg", () => {
  const headers = attachmentHeaders("hyundai-creta-2022-01.jpg", "image/jpeg");
  assert.equal(headers["Content-Type"], "image/jpeg");
  assert.equal(
    headers["Content-Disposition"],
    'attachment; filename="hyundai-creta-2022-01.jpg"',
  );
  assert.equal(headers["Cache-Control"], "private, no-store");
});
