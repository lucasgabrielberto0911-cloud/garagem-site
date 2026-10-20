import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAccessories, sanitizeAccessory } from "./vehicle-accessories";

test("sanitizeAccessory trunca em palavras inteiras e fecha parênteses", () => {
  assert.equal(
    sanitizeAccessory("Painel digital blackout (velocímetro digital, hodômetro e marcador de combustíve"),
    "Painel digital blackout (velocímetro digital, hodômetro e marcador de combustível)",
  );

  assert.equal(
    sanitizeAccessory("Tampa do tanque de combustível estilo aviação (articulada"),
    "Tampa do tanque de combustível estilo aviação (articulada)",
  );

  assert.equal(
    sanitizeAccessory("Painel com conta-giros (tacômetro"),
    "Painel com conta-giros (tacômetro)",
  );

  assert.equal(
    sanitizeAccessory("Assento largo (piloto + garupa"),
    "Assento largo (piloto + garupa)",
  );

  // Trunca em palavra inteira sem cortar ao meio
  const longText = "Freios ABS com distribuição eletrônica de frenagem EBD e assistência de frenagem de urgência BAS";
  const truncated = sanitizeAccessory(longText, 60);
  assert.ok(truncated.length <= 60);
  assert.equal(truncated, "Freios ABS com distribuição eletrônica de frenagem EBD e");
});

test("normalizeAccessories sanitiza itens e remove duplicados", () => {
  const result = normalizeAccessories([
    "Painel com conta-giros (tacômetro",
    "painel com conta-giros (tacômetro)",
  ]);
  assert.deepEqual(result, ["Painel com conta-giros (tacômetro)"]);
});

test("exibição preserva textos longos válidos; entrada respeita limite com parênteses", () => {
  const text = "Sistema multimídia original com câmera de ré, Bluetooth e comandos no volante (compatível com Android Auto e Apple CarPlay)";
  assert.equal(sanitizeAccessory(text), text);
  assert.equal(sanitizeAccessory("ABS EBD adicional", 7), "ABS EBD");
  assert.equal(sanitizeAccessory("Palavramuitolonga", 5), "");
  assert.equal(sanitizeAccessory("ABS", 0), "");
  for (const limit of [7, 20, 40, 60, 100]) {
    const value = sanitizeAccessory(text, limit);
    assert.ok(value.length <= limit);
    assert.equal((value.match(/\(/g) ?? []).length, (value.match(/\)/g) ?? []).length);
    assert.equal(sanitizeAccessory(value, limit), value);
  }
  const nested = sanitizeAccessory("Rádio (USB (dianteiro e traseiro", 31);
  assert.equal(nested, "Rádio (USB (dianteiro e))");
  assert.ok(normalizeAccessories([text])[0].length <= 100);
});
