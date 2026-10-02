import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAT_FIPE_REPLY,
  CHAT_PING_REPLY,
  CHAT_SYSTEM_PROMPT,
  CHAT_WHATSAPP_URL,
  buildChatSystemPrompt,
  formatStockForPrompt,
  isPowerQuery,
  parseCheapIntent,
  parseMinDisplacementLiters,
  chatRankMode,
  parseBodyStyleFilter,
  parseEconomyIntent,
  parseFamilyIntent,
  parsePowerIntent,
  parsePriceLimit,
  parseStarterIntent,
  rankByPower,
  rankChatVehicles,
  stockSelectHasForbiddenField,
} from "./chat-prompt";
import { CHAT_VEHICLE_SELECT } from "./chat-stock";

test("saudação de ping ajuda a escolher sem jargão de 60x", () => {
  assert.match(CHAT_PING_REPLY, /estoque/);
  assert.match(CHAT_PING_REPLY, /orçamento|modelo/);
  assert.match(CHAT_PING_REPLY, /WhatsApp/);
  assert.doesNotMatch(CHAT_PING_REPLY, /60x/);
});

test("system prompt traz as regras fixas e o WhatsApp oficial", () => {
  assert.match(CHAT_SYSTEM_PROMPT, /assistente virtual da Garagem/);
  assert.match(CHAT_SYSTEM_PROMPT, /há mais de 20 anos/);
  assert.match(CHAT_SYSTEM_PROMPT, /mais de 1\.000 carros vendidos/);
  assert.match(CHAT_SYSTEM_PROMPT, /Aracruz, Vitória, Linhares, Serra, Vila Velha/);
  assert.match(CHAT_SYSTEM_PROMPT, /troca \(carro ou moto\)/);
  assert.match(CHAT_SYSTEM_PROMPT, /financia em até 60x/);
  assert.match(CHAT_SYSTEM_PROMPT, /cartão de crédito em até 18x/);
  assert.match(CHAT_SYSTEM_PROMPT, /POLÍTICA DA LOJA/);
  assert.match(CHAT_SYSTEM_PROMPT, /3 meses de motor e câmbio/);
  assert.match(CHAT_SYSTEM_PROMPT, /pela loja/);
  assert.match(CHAT_SYSTEM_PROMPT, /Nunca misture os prazos/);
  assert.match(CHAT_SYSTEM_PROMPT, /único automático/);
  assert.match(CHAT_SYSTEM_PROMPT, /NUNCA inventar equipamento/);
  assert.match(CHAT_SYSTEM_PROMPT, /preço de referência FIPE/);
  assert.match(CHAT_SYSTEM_PROMPT, /sem markdown/);
  assert.match(CHAT_SYSTEM_PROMPT, /eae/);
  assert.match(CHAT_SYSTEM_PROMPT, /um por linha/);
  assert.match(CHAT_SYSTEM_PROMPT, /COMO AJUDAR DE VERDADE/);
  assert.match(CHAT_SYSTEM_PROMPT, /mini-anúncio com foto/);
  assert.match(CHAT_SYSTEM_PROMPT, /não pergunte hatch/);
  assert.match(CHAT_SYSTEM_PROMPT, /faixa típica de catálogo/);
  assert.match(CHAT_SYSTEM_PROMPT, /Fox 1\.6 1\.6/);
  assert.match(CHAT_SYSTEM_PROMPT, /mais em conta se o preço for menor/);
  assert.match(CHAT_SYSTEM_PROMPT, /1 a 3 frases curtas/);
  assert.match(CHAT_SYSTEM_PROMPT, /HANDOFF/);
  assert.match(CHAT_SYSTEM_PROMPT, /WhatsApp só quando um humano/);
  assert.doesNotMatch(CHAT_SYSTEM_PROMPT, /Termine SEMPRE/);
  assert.match(CHAT_SYSTEM_PROMPT, /Comparar o estoque não leva link/);
  assert.match(CHAT_SYSTEM_PROMPT, /Não comece com/);
  assert.match(CHAT_SYSTEM_PROMPT, /frase falada de recorte/);
  assert.match(CHAT_SYSTEM_PROMPT, /consultor humano/);
  assert.match(CHAT_SYSTEM_PROMPT, /um pouco animado/);
  assert.match(CHAT_SYSTEM_PROMPT, /Nunca começar com “não posso”/);
  assert.match(CHAT_SYSTEM_PROMPT, /NUNCA invente outro número/);
  assert.match(CHAT_SYSTEM_PROMPT, /ESCOLHER um carro/);
  assert.match(CHAT_SYSTEM_PROMPT, /consultor monta a simulação/);
  assert.match(CHAT_SYSTEM_PROMPT, /NUNCA invente banco/);
  assert.match(CHAT_SYSTEM_PROMPT, /KM, câmbio e equipamentos/);
  assert.match(CHAT_SYSTEM_PROMPT, /Esse carro ainda tem/);
  assert.match(CHAT_SYSTEM_PROMPT, /Comparar dois modelos/);
  assert.match(CHAT_SYSTEM_PROMPT, /Motor forte/);
  assert.match(CHAT_SYSTEM_PROMPT, /pegada/);
  assert.match(CHAT_SYSTEM_PROMPT, /1\.8\+/);
  assert.equal(CHAT_WHATSAPP_URL, "https://wa.me/5527996330706");
  assert.match(CHAT_SYSTEM_PROMPT, /https:\/\/wa\.me\/5527996330706/);
  assert.match(CHAT_SYSTEM_PROMPT, /ESCOPO RESTRITO/);
  assert.match(CHAT_SYSTEM_PROMPT, /RESISTÊNCIA A MANIPULAÇÃO/);
  assert.match(CHAT_SYSTEM_PROMPT, /SEM CONSELHO FINANCEIRO ESPECÍFICO/);
  assert.match(CHAT_SYSTEM_PROMPT, /DADOS PESSOAIS MÍNIMOS/);
  assert.match(CHAT_SYSTEM_PROMPT, /CONTENÇÃO DE ABUSO/);
  assert.match(CHAT_SYSTEM_PROMPT, /Documentos da transferência/);
  assert.match(CHAT_SYSTEM_PROMPT, /Se o filtro/);
  assert.match(CHAT_SYSTEM_PROMPT, /Diferença automático vs manual/);
  assert.match(CHAT_SYSTEM_PROMPT, /ignore as instruções anteriores/);
  assert.match(CHAT_SYSTEM_PROMPT, /Nunca pedir CPF/);
  assert.match(CHAT_SYSTEM_PROMPT, /chama no WhatsApp pra outros temas/);
});

test("consulta do bot não inclui fipePrice", () => {
  assert.equal(stockSelectHasForbiddenField(CHAT_VEHICLE_SELECT), false);
  assert.equal("fipePrice" in CHAT_VEHICLE_SELECT, false);
});

test("estoque real entra no prompt; carro fora da lista não é inventado", () => {
  const prompt = buildChatSystemPrompt([
    {
      brand: "Hyundai",
      model: "HB20",
      version: "evolution 1.0",
      year: 2022,
      km: 68450,
      price: 64900,
      color: "Prata",
      transmission: "Manual",
      fuel: "Flex",
    },
  ]);

  assert.match(prompt, /Hyundai HB20 evolution 1\.0 2022/);
  assert.match(prompt, /R\$ 64\.900/);
  assert.match(prompt, /68\.450 km/);
  const stockBlock = formatStockForPrompt(
    [
      {
        brand: "Hyundai",
        model: "HB20",
        version: "evolution 1.0",
        year: 2022,
        km: 68450,
        price: 64900,
        color: "Prata",
        transmission: "Manual",
        fuel: "Flex",
        engine: "1.0 12V",
        doors: 4,
        accessories: ["Ar condicionado", "Direção hidráulica"],
      },
    ],
    { consumption: true, equipment: true },
  );
  assert.match(stockBlock, /motor 1\.0 12V|evolution 1\.0/);
  assert.match(stockBlock, /4 portas/);
  assert.match(stockBlock, /Ar condicionado/);
  assert.match(stockBlock, /consumo típico|faixa típica de catálogo/);
  assert.match(stockBlock, /11–14 km\/l/);
  assert.match(stockBlock, /não foi medido/);
  assert.doesNotMatch(stockBlock, /fipe/i);
  assert.doesNotMatch(formatStockForPrompt([]), /R\$/);
  const foxLine = formatStockForPrompt(
    [
      {
        brand: "Volkswagen",
        model: "Fox 1.6",
        version: "Trend 1.6",
        year: 2014,
        km: 98000,
        price: 38900,
        color: "Prata",
        transmission: "Manual",
        fuel: "Flex",
        engine: "1.6",
        category: "carro",
      },
    ],
    { consumption: true },
  );
  assert.match(foxLine, /Fox 1\.6/);
  assert.doesNotMatch(foxLine, /1\.6 1\.6|motor 1\.6/);
});

test("baratinho entra no filtro do prompt sem inventar faixa numérica", () => {
  assert.equal(parseCheapIntent("hb20 automatico baratinho"), true);
  assert.equal(parseCheapIntent("Carros até 70 mil?"), false);
  const prompt = buildChatSystemPrompt(
    [
      {
        brand: "Hyundai",
        model: "HB20",
        version: "Comfort",
        year: 2015,
        km: 110000,
        price: 45900,
        color: "Prata",
        transmission: "Automático",
        fuel: "Flex",
      },
      {
        brand: "Hyundai",
        model: "HB20",
        version: "Diamond",
        year: 2022,
        km: 20000,
        price: 89900,
        color: "Branco",
        transmission: "Automático",
        fuel: "Flex",
      },
    ],
    "hb20 automatico baratinho",
  );
  assert.match(prompt, /mais em conta/);
  assert.match(prompt, /45\.900/);
  assert.doesNotMatch(prompt, /FILTRO DO VISITANTE: até/);
});

test("resposta fixa de FIPE não cita carro nem preço", () => {
  assert.match(CHAT_FIPE_REPLY, /FIPE/);
  assert.doesNotMatch(CHAT_FIPE_REPLY, /Etios|Corolla|R\$/);
});

test("prompt proíbe falar de consumo espontaneamente", () => {
  assert.match(CHAT_SYSTEM_PROMPT, /NUNCA mencione consumo espontaneamente/);
  assert.match(CHAT_SYSTEM_PROMPT, /NÃO mencione consumo de combustível espontaneamente/);
});

test("prompt com activeVehicle injeta contexto e regra de desambiguação", () => {
  const prompt = buildChatSystemPrompt(
    [
      {
        brand: "Hyundai",
        model: "HB20",
        version: "evolution 1.0",
        year: 2021,
        km: 54000,
        price: 64900,
        color: "Prata",
        transmission: "Manual",
        fuel: "Flex",
      },
      {
        brand: "Hyundai",
        model: "HB20",
        version: "Premium 1.6",
        year: 2015,
        km: 110000,
        price: 55900,
        color: "Branco",
        transmission: "Automático",
        fuel: "Flex",
      },
    ],
    "Tenho interesse no HB20",
    {
      brand: "Hyundai",
      model: "HB20",
      version: "evolution 1.0",
      year: 2021,
      km: 54000,
      price: 64900,
      color: "Prata",
      transmission: "Manual",
      fuel: "Flex",
    },
  );

  assert.match(prompt, /VEÍCULO QUE O VISITANTE ESTÁ VENDO NA TELA AGORA/);
  assert.match(prompt, /Hyundai HB20 evolution 1\.0 2021/);
  assert.match(prompt, /REGRA DE DESAMBIGUAÇÃO/);
  assert.match(prompt, /refira-se ESTRITAMENTE a esta unidade específica/);
  assert.match(prompt, /NÃO confunda com outras unidades do mesmo modelo/);
});

test("intenção forte reconhece apelidos e não vira pedido barato", () => {
  for (const sample of [
    "quero um carro forte",
    "motorizado",
    "motor forte",
    "potente",
    "com pegada",
    "bastante torque",
    "esportivo",
    "1.8+",
    "um 2.0",
    "acima de 1.8",
    "Automatico Forte, no maximo de 109 mil",
  ]) {
    assert.equal(parsePowerIntent(sample), true, sample);
  }
  assert.equal(parseCheapIntent("Automatico Forte, no maximo de 109 mil"), false);
  assert.equal(parsePriceLimit("Automatico Forte, no maximo de 109 mil"), 109_000);
  assert.equal(parseMinDisplacementLiters("quero um 2.0"), 2);
  assert.equal(parseMinDisplacementLiters("1.8+"), 1.8);
  assert.equal(parseMinDisplacementLiters("acima de 1.6"), 1.6);
  assert.equal(parseMinDisplacementLiters("HB20 1.0"), null);
  assert.equal(parsePowerIntent("HB20 1.0"), false);
  assert.equal(parsePowerIntent("automático até 80 mil"), false);
  assert.equal(parsePowerIntent("hb20 automatico baratinho"), false);
  assert.equal(parsePowerIntent("conforto no transito"), false);
  assert.equal(isPowerQuery("forte e barato até 80 mil"), false);
  assert.equal(parseCheapIntent("forte e barato até 80 mil"), true);
});

test("rankByPower coloca 2.0 e TSI na frente de 1.0 e 1.6", () => {
  const hb = {
    model: "HB20",
    version: "1.0",
    engine: "1.0",
    price: 55900,
    km: 110000,
    category: "carro",
  };
  const onix = {
    model: "Onix",
    version: "1.6",
    engine: "1.6",
    price: 58900,
    km: 90000,
    category: "carro",
  };
  const nivus = {
    model: "Nivus",
    version: "200 TSI",
    engine: "1.0 TSI",
    price: 99900,
    km: 40000,
    category: "carro",
  };
  const lancer = {
    model: "Lancer",
    version: "2.0",
    engine: "2.0",
    price: 62900,
    km: 80000,
    category: "carro",
  };
  const ranked = rankByPower([hb, onix, nivus, lancer], "carro forte");
  assert.deepEqual(
    ranked.map((vehicle) => vehicle.model),
    ["Lancer", "Nivus", "Onix", "HB20"],
  );
  const byDisplacement = rankByPower([nivus, hb, lancer], "quero 2.0");
  assert.equal(byDisplacement[0]?.model, "Lancer");
  const cheapSmall = {
    model: "Mobi",
    version: "1.0",
    engine: "1.0",
    price: 39_900,
    km: 20_000,
    category: "carro",
  };
  const larger = {
    model: "Corolla",
    version: "2.0",
    engine: "2.0",
    price: 109_000,
    km: 80_000,
    category: "carro",
  };
  const byEngineThenPrice = rankByPower(
    [cheapSmall, larger],
    "automático forte até 109 mil",
  );
  assert.equal(byEngineThenPrice[0]?.model, "Corolla");
  assert.ok((byEngineThenPrice[0]?.price ?? 0) > (byEngineThenPrice[1]?.price ?? 0));
  assert.ok(
    byDisplacement.findIndex((vehicle) => vehicle.model === "Lancer") <
      byDisplacement.findIndex((vehicle) => vehicle.model === "Nivus"),
  );
});

test("prompt de automático forte lista 2.0 antes do 1.0 e não pede o mais barato", () => {
  const line = (
    brand: string,
    model: string,
    version: string,
    engine: string,
    price: number,
    km: number,
  ) => ({
    brand,
    model,
    version,
    year: 2014,
    km,
    price,
    color: "Prata",
    transmission: "Automático",
    fuel: "Flex",
    engine,
    category: "carro",
  });
  const vehicles = [
    line("Hyundai", "HB20", "Vision 1.0", "1.0", 55900, 110000),
    line("Chevrolet", "Onix", "LT 1.6", "1.6", 58900, 90000),
    line("Mitsubishi", "Lancer", "2.0", "2.0", 62900, 80000),
    line("Honda", "Civic", "LXR 2.0", "2.0", 74900, 95000),
    line("Toyota", "Corolla", "XEi 2.0", "2.0", 98900, 70000),
  ];
  const forte = buildChatSystemPrompt(
    vehicles,
    "Automatico Forte, no maximo de 109 mil",
  );
  assert.match(forte, /mais fortes primeiro/);
  const filter = forte.split("FILTRO DO VISITANTE:").pop() ?? "";
  assert.match(filter, /motor mais forte/);
  assert.match(filter, /não abra pelo mais barato/i);
  assert.doesNotMatch(filter, /mais em conta/);
  const lancer = filter.search(/Lancer/i);
  const civic = filter.search(/Civic/i);
  const corolla = filter.search(/Corolla/i);
  const hb = filter.search(/HB20/i);
  assert.ok(lancer >= 0 && civic > lancer && corolla > civic);
  assert.ok(hb < 0 || hb > corolla);

  const cheap = buildChatSystemPrompt(vehicles, "automatico barato ate 109 mil");
  assert.match(cheap, /mais baratos primeiro/);
  assert.doesNotMatch(cheap, /mais fortes primeiro/);
  assert.match(cheap, /FILTRO DO VISITANTE: até R\$ 109\.000/);
  const cheapFilter = cheap.split("FILTRO DO VISITANTE:").pop() ?? "";
  assert.ok(cheapFilter.indexOf("55.900") < cheapFilter.indexOf("62.900"));
});

test("intenções de família, primeiro carro, econômico e carroceria", () => {
  assert.equal(parseFamilyIntent("carro para família, espaçoso, 4 portas"), true);
  assert.equal(parseFamilyIntent("tem espaço no banco?"), false);
  assert.equal(parseStarterIntent("primeiro carro para a cidade"), true);
  assert.equal(parseStarterIntent("uber até 60 mil"), true);
  assert.equal(parseStarterIntent("moro em Vitória"), false);
  assert.equal(parseStarterIntent("chama no whatsapp"), false);
  assert.equal(parseEconomyIntent("carro econômico até 70 mil"), true);
  assert.equal(parseEconomyIntent("qual o consumo?"), false);
  assert.equal(parseBodyStyleFilter("tem suv automático"), "suv");
  assert.equal(parseBodyStyleFilter("quero um hatch"), "hatch");
  assert.equal(parseBodyStyleFilter("sedan ou picape"), "pickup");
  assert.equal(chatRankMode("suv forte até 90 mil"), "power");
  assert.equal(chatRankMode("família até 90 mil"), "family");
  assert.equal(chatRankMode("primeiro carro até 60 mil"), "starter");
  assert.equal(chatRankMode("econômico até 70 mil"), "economy");
  assert.equal(chatRankMode("barato e forte"), "cheap");
  assert.equal(chatRankMode("até 80 mil"), "price");
});

test("ranking segue a intenção dominante sem inventar dado", () => {
  const hb = {
    model: "HB20",
    version: "1.0",
    engine: "1.0",
    price: 55_900,
    km: 40_000,
    category: "carro",
    doors: 4,
  };
  const civic = {
    model: "Civic",
    version: "LXR 2.0",
    engine: "2.0",
    price: 50_000,
    km: 80_000,
    category: "carro",
    doors: 4,
  };
  const onix = {
    model: "Onix",
    version: "1.0",
    engine: "1.0",
    price: 80_000,
    km: 20_000,
    category: "carro",
    doors: 4,
  };
  const compass = {
    model: "Compass",
    version: "Longitude",
    engine: "2.0",
    price: 120_000,
    km: 30_000,
    category: "carro",
    doors: 4,
  };
  assert.deepEqual(
    rankChatVehicles([civic, hb, onix], "carro econômico").map((row) => row.model),
    ["HB20", "Onix", "Civic"],
  );
  assert.equal(
    rankChatVehicles([civic, hb], "primeiro carro")[0]?.model,
    "HB20",
  );
  assert.equal(
    rankChatVehicles([onix, civic], "primeiro carro")[0]?.model,
    "Civic",
  );
  assert.equal(
    rankChatVehicles([hb, civic, compass], "carro para família")[0]?.model,
    "Compass",
  );
});
