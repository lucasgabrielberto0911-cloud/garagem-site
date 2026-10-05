import assert from "node:assert/strict";
import { test } from "node:test";
import { isOversizedHeic } from "./admin-photo-validation";

test("fotos comprimíveis de celular acima de 3 MB seguem no envio", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
    assert.equal(isOversizedHeic({ name: "foto.jpg", type, size: 12 * 1024 * 1024 }), false);
  }
});

test("HEIC/HEIF só é recusado acima do limite, por MIME ou extensão", () => {
  const limit = 3 * 1024 * 1024;
  for (const [name, type] of [["foto.HEIC", ""], ["foto.HEIF", ""], ["foto", "image/heic"], ["foto", "image/heif"]]) {
    assert.equal(isOversizedHeic({ name, type, size: limit }), false);
    assert.equal(isOversizedHeic({ name, type, size: limit + 1 }), true);
  }
});
