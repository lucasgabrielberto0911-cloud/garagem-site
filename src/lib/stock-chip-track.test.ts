import assert from "node:assert/strict";
import { test } from "node:test";
import { chipTrackInsets } from "@/lib/stock-chip-track";

test("faixa inteira fica visível e o chip seguinte cortado some por inteiro", () => {
  const view = { left: 80, right: 358 };
  const chips = [
    { left: 80, right: 156 },
    { left: 164, right: 239 },
    { left: 247, right: 328 },
    { left: 336, right: 423 },
  ];
  const fit = chipTrackInsets(view, chips);
  assert.deepEqual(fit.hidden, [false, false, false, true]);
  assert.equal(fit.insetLeft, 0);
  assert.equal(fit.insetRight, view.right - 336);
});

test("marca que cabe no trilho não é escondida", () => {
  const view = { left: 80, right: 358 };
  const chips = [
    { left: 80, right: 136 },
    { left: 144, right: 190 },
    { left: 198, right: 255 },
    { left: 263, right: 351 },
  ];
  const fit = chipTrackInsets(view, chips);
  assert.deepEqual(fit.hidden, [false, false, false, false]);
  assert.equal(fit.insetLeft, 0);
  assert.equal(fit.insetRight, 0);
});

test("chip pendurado na esquerda também some inteiro", () => {
  const view = { left: 200, right: 478 };
  const chips = [
    { left: 120, right: 210 },
    { left: 218, right: 300 },
  ];
  const fit = chipTrackInsets(view, chips);
  assert.deepEqual(fit.hidden, [true, false]);
  assert.equal(fit.insetLeft, 210 - view.left);
  assert.equal(fit.insetRight, 0);
});
