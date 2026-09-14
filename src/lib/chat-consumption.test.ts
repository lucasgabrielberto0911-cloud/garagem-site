import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseEngineDisplacementLiters,
  typicalConsumptionHint,
  typicalConsumptionRange,
} from "./chat-consumption";
import {
  asksAboutConsumption,
  consumptionReplyLooksBroken,
  enrichChatStockReply,
  formatFocusedConsumptionReply,
  type ChatVehicleRecord,
} from "./chat-stock";

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
  assert.match(palio18?.city ?? "", /álcool/);
  assert.equal(palio18?.ethanolKmL, "6–8 km/l");

  const fox16 = typicalConsumptionRange({
    fuel: "Flex",
    engine: "1.6",
    category: "carro",
  });
  assert.equal(fox16?.kmL, "9–12 km/l");
  assert.equal(fox16?.ethanolKmL, "6–8 km/l");
  assert.match(fox16?.city ?? "", /gasolina/);
  assert.match(fox16?.city ?? "", /álcool/);

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

const fox: ChatVehicleRecord = {
  id: "c-fox-16",
  brand: "Volkswagen",
  model: "Fox",
  version: "Trend 1.6",
  yearModel: 2014,
  km: 98000,
  price: 38900,
  color: "Prata",
  transmission: "Manual",
  fuel: "Flex",
  engine: "1.6",
  category: "carro",
};

test("template de consumo nunca cola o disclaimer no fica", () => {
  const reply = formatFocusedConsumptionReply(fox);
  assert.match(reply, /9–12 km\/l/);
  assert.match(reply, /6–8 km\/l/);
  assert.match(reply, /gasolina/);
  assert.match(reply, /álcool/);
  assert.match(reply, /não foi medido/);
  assert.doesNotMatch(reply, /fica\s+Nenhum desses/i);
  assert.equal(
    consumptionReplyLooksBroken(
      "Para o Volkswagen Fox 1.6, a faixa típica de catálogo fica",
    ),
    true,
  );
  assert.equal(
    consumptionReplyLooksBroken(
      "Para o Volkswagen Fox 1.6, a faixa típica de catálogo fica Nenhum desses usados foi medido na loja.",
    ),
    true,
  );
  assert.equal(
    consumptionReplyLooksBroken("Para o Volkswagen Fox com motor 1.6 flex"),
    true,
  );
  assert.equal(
    consumptionReplyLooksBroken("No Volkswagen Fox com motor 1.6"),
    true,
  );
  assert.equal(
    consumptionReplyLooksBroken(
      "No estoque agora tem, entre outros: Honda BIZ 125 2023.",
    ),
    false,
  );
  const repaired = enrichChatStockReply(
    "Para o Volkswagen Fox 1.6, a faixa típica de catálogo fica",
    [fox],
    "Qual consumo do fox",
  );
  assert.match(repaired, /9–12 km\/l/);
  assert.doesNotMatch(repaired, /fica\s+Nenhum desses/i);
  assert.match(repaired, /não foi medido/);
});

test("sem faixa na ficha não usa o disclaimer como objeto do fica", () => {
  const comfort: ChatVehicleRecord = {
    ...fox,
    id: "c-fox-comfort",
    engine: null,
    version: "Comfort",
  };
  const reply = formatFocusedConsumptionReply(comfort);
  assert.doesNotMatch(reply, /fica\s+Nenhum desses/i);
  assert.match(reply, /não tenho faixa de catálogo/i);
});
