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
