import assert from "node:assert/strict";
import test from "node:test";
import { positivePoints } from "./chat-opinion";
import type { ChatVehicleRecord } from "./chat-stock";

const car = (model: string, version: string, engine: string, year: number, accessories: string[] = [], transmission = "Manual"): ChatVehicleRecord => ({
  id: model, brand: model === "Palio" ? "Fiat" : "Honda", model, version, yearModel: year, engine, transmission, fuel: "Flex",
  category: "carro", color: null, price: 30000, km: 85000, accessories,
});

test("Palio 1.0 (motor fraco) nunca cita cv nem potência e traz 4 a 6 pontos com dado", () => {
  const points = positivePoints(car("Palio", "Fire 1.0", "1.0", 2008, ["Ar-condicionado", "Direção hidráulica", "Vidros elétricos"]));
  const text = points.map(([label, value]) => `${label} ${value}`).join("\n");
  assert.doesNotMatch(text, /\bcv\b|cavalos|potência|Motor/i);
  assert.match(text, /km\/l/);
  assert.match(text, /85\.000 km/);
  assert.ok(points.length >= 4 && points.length <= 6, text);
  for (const [, value] of points) assert.match(value, /\d|ar-condicionado|CVT|automático|baratas|peças/i);
});

test("carro forte pode citar o motor", () => {
  const points = positivePoints(car("Civic", "EXL 2.0", "2.0", 2018, ["Multimídia"], "Automático"));
  assert.ok(points.some(([label, value]) => label === "Motor" && /cv/.test(value)));
});
