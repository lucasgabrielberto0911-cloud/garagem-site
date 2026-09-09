import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseEngineDisplacementLiters,
  typicalConsumptionHint,
  typicalConsumptionRange,
} from "./chat-consumption";
import { asksAboutConsumption } from "./chat-stock";

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
  assert.equal(palio18?.kmL, "8–11 km/l");
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

test("detecta perguntas específicas sobre consumo de combustível", () => {
  assert.equal(asksAboutConsumption("qual o consumo desse carro?"), true);
  assert.equal(asksAboutConsumption("qual o km/l dele na cidade?"), true);
  assert.equal(asksAboutConsumption("ele faz quantos km l?"), true);
  assert.equal(asksAboutConsumption("quantos kml faz?"), true);
  assert.equal(asksAboutConsumption("ele é economico?"), true);
  assert.equal(asksAboutConsumption("bebe muito na cidade?"), true);
  assert.equal(asksAboutConsumption("quantos km faz por litro?"), true);
  assert.equal(asksAboutConsumption("qual a autonomia do tanque?"), true);

  // Perguntas que NÃO devem ativar o bloco de consumo
  assert.equal(asksAboutConsumption("qual o valor do carro?"), false);
  assert.equal(asksAboutConsumption("aceita troca?"), false);
  assert.equal(asksAboutConsumption("tem garantia?"), false);
  assert.equal(asksAboutConsumption("como funciona o financiamento?"), false);
  assert.equal(asksAboutConsumption("quanto custa a transferência?"), false);
});
