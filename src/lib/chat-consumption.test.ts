import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseEngineDisplacementLiters,
  typicalConsumptionHint,
  typicalConsumptionRange,
} from "./chat-consumption";

test("lê cilindrada do motor, da versão e de moto em cc", () => {
  assert.equal(parseEngineDisplacementLiters("2.0 TSI", null), 2);
  assert.equal(parseEngineDisplacementLiters(null, "Sed. Joy/LS 1.0 8V"), 1);
  assert.equal(parseEngineDisplacementLiters("1.8 16V Flex", "Adventure"), 1.8);
  assert.equal(parseEngineDisplacementLiters("160cc", null, "moto"), 0.16);
  assert.equal(parseEngineDisplacementLiters(null, "EX 125 FLEX", "moto"), 0.125);
  assert.equal(parseEngineDisplacementLiters(null, "Comfort Plus", "carro"), null);
});

test("faixa de consumo é catálogo, nunca medição do usado", () => {
  const flex10 = typicalConsumptionHint({
    fuel: "Flex",
    version: "Joy 1.0",
    category: "carro",
  });
  assert.match(flex10, /1\.0 flex/);
  assert.match(flex10, /11–14 km\/l/);
  assert.match(flex10, /catálogo/);
  assert.match(flex10, /não foi medido/);

  const palio18 = typicalConsumptionRange({
    fuel: "Flex",
    engine: "1.8 16V",
    category: "carro",
  });
  assert.equal(palio18?.label, "1.8");
  assert.match(palio18?.city ?? "", /8–11 km\/l/);

  const biz = typicalConsumptionHint({
    fuel: "Flex",
    version: "EX 125 FLEX",
    category: "moto",
  });
  assert.match(biz, /125cc/);
  assert.match(biz, /35–45/);

  const hybrid = typicalConsumptionHint({
    fuel: "Híbrido",
    engine: "1.8",
    category: "carro",
  });
  assert.match(hybrid, /híbrido/);
  assert.match(hybrid, /15–22/);

  const electric = typicalConsumptionHint({
    fuel: "Elétrico",
    category: "carro",
  });
  assert.match(electric, /elétrico/);
  assert.match(electric, /sem km\/l/);
  assert.doesNotMatch(electric, /\d+–\d+ km\/l cidade \(gasolina\)/);

  const unknown = typicalConsumptionHint({
    fuel: "Flex",
    version: "Comfort",
    category: "carro",
  });
  assert.match(unknown, /1\.0 flex costuma gastar menos/);
  assert.match(unknown, /não foi medido/);
});
