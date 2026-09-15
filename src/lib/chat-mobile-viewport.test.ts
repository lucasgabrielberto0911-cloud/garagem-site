import assert from "node:assert/strict";
import { test } from "node:test";
import { chatMobileKeyboardCovered } from "./chat-mobile-viewport";

test("sem teclado o inset é zero e o chat não entra em modo teclado", () => {
  const result = chatMobileKeyboardCovered({
    innerHeight: 844,
    viewportHeight: 844,
    viewportOffsetTop: 0,
  });
  assert.equal(result.covered, 0);
  assert.equal(result.keyboardOpen, false);
});

test("teclado iOS típico (~336px) marca o modo teclado", () => {
  const result = chatMobileKeyboardCovered({
    innerHeight: 844,
    viewportHeight: 508,
    viewportOffsetTop: 0,
  });
  assert.equal(result.covered, 336);
  assert.equal(result.keyboardOpen, true);
});

test("offsetTop do visualViewport entra no cálculo (Safari)", () => {
  const result = chatMobileKeyboardCovered({
    innerHeight: 844,
    viewportHeight: 500,
    viewportOffsetTop: 40,
  });
  assert.equal(result.covered, 304);
  assert.equal(result.keyboardOpen, true);
});

test("recorte pequeno da barra do browser não dispara o modo teclado", () => {
  const result = chatMobileKeyboardCovered({
    innerHeight: 844,
    viewportHeight: 800,
    viewportOffsetTop: 0,
  });
  assert.equal(result.covered, 44);
  assert.equal(result.keyboardOpen, false);
});
