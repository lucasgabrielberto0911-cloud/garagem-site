import assert from "node:assert/strict";
import { test } from "node:test";
import { formatListedAgo, formatModelName, formatVehicleLabel, resolvePlateEnd } from "./format";

test("FOX da FIPE vira Fox na vitrine, sem virar sigla", () => {
  assert.equal(formatModelName("FOX 1.6"), "Fox 1.6");
  assert.equal(formatModelName("LANCER"), "Lancer");
  assert.equal(formatVehicleLabel("Volkswagen", "FOX 1.6"), "Volkswagen Fox 1.6");
  assert.equal(formatModelName("BMW"), "BMW");
  assert.equal(formatModelName("GII"), "GII");
});

test("formatListedAgo aceita Date e ISO sem quebrar", () => {
  assert.equal(formatListedAgo(new Date()), "Anunciado hoje");
  assert.equal(formatListedAgo(new Date().toISOString()), "Anunciado hoje");
  assert.equal(formatListedAgo("não-é-data"), "");
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
  assert.equal(formatListedAgo(twoDaysAgo.toISOString()), "Anunciado há 2 dias");
});

test("final da placa: usa a placa interna e preserva o cadastrado sem ela", () => {
  assert.equal(resolvePlateEnd("ABC-1234", "7"), "4");
  assert.equal(resolvePlateEnd("", "7"), "7");
  assert.equal(resolvePlateEnd("", null), "");
});
