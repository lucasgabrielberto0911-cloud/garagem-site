import assert from "node:assert/strict";
import { test } from "node:test";
import { clampPhotoOffset } from "./photo-zoom";

test("foto horizontal no celular: arraste vertical não tira a imagem do enquadramento", () => {
  const viewport = { width: 390, height: 710, imageWidth: 1280, imageHeight: 720, scale: 2.4 };
  assert.deepEqual(clampPhotoOffset({ x: 350, y: 350 }, viewport), { x: 273, y: 0 });
  assert.deepEqual(clampPhotoOffset({ x: -350, y: -350 }, viewport), { x: -273, y: -0 });
});

test("foto vertical permite explorar as duas bordas sem sair da imagem", () => {
  const viewport = { width: 400, height: 600, imageWidth: 800, imageHeight: 1200, scale: 2 };
  assert.deepEqual(clampPhotoOffset({ x: 900, y: -900 }, viewport), { x: 200, y: -300 });
  assert.deepEqual(clampPhotoOffset({ x: -900, y: 900 }, viewport), { x: -200, y: 300 });
});

test("reduzir zoom recentra os eixos que já cabem na janela", () => {
  const base = { width: 400, height: 600, imageWidth: 800, imageHeight: 1200 };
  assert.deepEqual(clampPhotoOffset({ x: 200, y: 300 }, { ...base, scale: 1.5 }), { x: 100, y: 150 });
  assert.deepEqual(clampPhotoOffset({ x: 200, y: 300 }, { ...base, scale: 1 }), { x: 0, y: 0 });
});

test("mudança de orientação recalcula o enquadramento sem perder a foto", () => {
  assert.deepEqual(clampPhotoOffset({ x: 200, y: 300 }, {
    width: 600, height: 400, imageWidth: 800, imageHeight: 1200, scale: 2,
  }), { x: 0, y: 200 });
});

test("foto ainda sem dimensões fica centralizada", () => {
  assert.deepEqual(clampPhotoOffset({ x: 200, y: 300 }, {
    width: 390, height: 710, imageWidth: 0, imageHeight: 0, scale: 2.4,
  }), { x: 0, y: 0 });
});
