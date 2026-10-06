import assert from "node:assert/strict";
import { test } from "node:test";
import { assessCoverPhoto } from "./cover-photo-quality";

function pixels(fn: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(64 * 48 * 4);
  for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = fn(x, y); data[i + 3] = 255;
  }
  return data;
}
test("aponta pouca luz e resolução insuficiente sem produzir aprovação de foto", () => {
  const result = assessCoverPhoto(320, 240, pixels(() => 12), 64, 48);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /pequena/);
  assert.match(result.warnings[1], /pouca luz/);
});
test("sinal de nitidez é cauteloso e não acusa fundo uniforme de desfoque", () => {
  assert.equal(assessCoverPhoto(1280, 960, pixels(() => 180), 64, 48).warnings.length, 0);
  const smooth = assessCoverPhoto(1280, 960, pixels(x => 60 + x * 2), 64, 48);
  assert.match(smooth.warnings[0], /sinal de pouco detalhe/);
  const detailed = assessCoverPhoto(1280, 960, pixels((x, y) => (x + y) % 2 ? 180 : 70), 64, 48);
  assert.equal(detailed.warnings.length, 0);
});
test("considera o recorte 4:3 de uma foto estreita", () => {
  assert.match(assessCoverPhoto(300, 1200, new Uint8ClampedArray(), 0, 0).warnings[0], /pequena/);
});
