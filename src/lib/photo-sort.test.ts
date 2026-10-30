import assert from "node:assert/strict";
import { test } from "node:test";
import { edgeScrollDelta, photoIndexAt, SCROLL_STEP, type PhotoBox } from "./photo-sort";

test("rola só perto das bordas da janela", () => {
  assert.equal(edgeScrollDelta(10, 700), -SCROLL_STEP);
  assert.equal(edgeScrollDelta(350, 700), 0);
  assert.equal(edgeScrollDelta(690, 700), SCROLL_STEP);
});

test("grade maior que a tela: dedo parado na borda inferior alcança a última foto", () => {
  const viewport = 700;
  const rows = 12; // 24 fotos em 2 colunas, 200 px por linha: 2400 px, bem além da tela
  const boxesAt = (scrollY: number): PhotoBox[] =>
    Array.from({ length: rows * 2 }, (_, index) => {
      const top = Math.floor(index / 2) * 200 - scrollY;
      const left = (index % 2) * 195;
      return { index, left, right: left + 190, top, bottom: top + 190 };
    });
  const finger = { x: 100, y: 695 };
  let scrollY = 0;
  let over: number | null = 0;
  // Um quadro do loop: rola e recalcula o destino sem nenhum pointermove novo.
  for (let frame = 0; frame < 400; frame++) {
    scrollY = Math.min(scrollY + edgeScrollDelta(finger.y, viewport), rows * 200 - viewport);
    const next = photoIndexAt(boxesAt(scrollY), finger.x, finger.y);
    if (next !== null) over = next;
  }
  assert.equal(over, 22);
});
