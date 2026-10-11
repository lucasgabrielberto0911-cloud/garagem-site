import assert from "node:assert/strict";
import { test } from "node:test";
import { runChatTurn } from "./chat-turn";
import { parseChatDisplacementFilter } from "./chat-search-filters";
import { matchedChatStock, type ChatVehicleRecord } from "./chat-stock";

const carro = (id: string, extra: Partial<ChatVehicleRecord> = {}): ChatVehicleRecord => ({
  id, brand: "Teste", model: id, version: "Versão de teste", engine: "1.0",
  yearModel: 2024, km: 40_000, price: 60_000, color: "Preto",
  transmission: "Automático", fuel: "Flex", category: "carro", accessories: [],
  ...extra,
});

const estoque = [
  carro("nivus", { model: "Nivus", version: "Highline TSI", engine: "1.0 TSI", yearModel: 2021, price: 104_900 }),
  carro("hb20s", { model: "HB20S", version: "Comfort Plus 1.0 TB", engine: "1.0 TGDI", price: 87_900 }),
  carro("hb-manual", { model: "HB20", version: "Evolution 1.0", engine: "1.0 Aspirado", transmission: "Manual", price: 64_900 }),
  carro("ka", { model: "Ka Sedan", version: "SE 1.5", engine: "1.5", price: 49_990 }),
  carro("civic", { model: "Civic", version: "LXR 2.0", engine: "2.0", price: 74_900 }),
  carro("hb-auto", { model: "HB20", version: "Premium 1.6", engine: "1.6", price: 56_900 }),
];

const perguntar = (mensagem: string, stock = estoque, vehicleId?: string) => runChatTurn({
  mensagem, historico: [], stock, vehicleId, readIntent: async () => null,
  generate: async () => { throw new Error(`Busca caiu no LLM: ${mensagem}`); },
});

for (const mensagem of ["quero um carro turbo", "tem carro turbo?", "tem turbo?"]) {
  test(`turbo busca a ficha sem virar modelo ausente: ${mensagem}`, async () => {
    const resposta = await perguntar(mensagem);
    assert.equal(resposta.meta?.policy, "inventory-search");
    assert.deepEqual(resposta.vehicles.map(v => v.id), ["hb20s", "nivus"]);
    assert.match(resposta.reply, /turbo.*ficha.*Garagem/);
    assert.doesNotMatch(resposta.reply, /não temos|lista atual|fontes|Sua Garagem/i);
  });
}

test("turbo reconhece marcadores do motor e da versão, limitando a três cards", async () => {
  const sinais = ["turbo", "TSI", "TB", "TGDI", "T-GDI", "T200", "T270", "1.0T", "1.0 T", "TFSI", "THP", "T-Jet", "EcoBoost"];
  for (const sinal of sinais) {
    for (const campo of ["engine", "version"] as const) {
      const ficha = carro("confirmado", { engine: null, version: null, [campo]: sinal });
      const falso = carro("somente-nome", { model: "Turbo", engine: "1.6", version: "Sport" });
      assert.deepEqual(matchedChatStock("carro turbo", [falso, ficha]).map(v => v.id), ["confirmado"], `${campo}: ${sinal}`);
    }
  }
  const resposta = await perguntar("quero carro turbo", sinais.map((sinal, i) => carro(`turbo-${i}`, { engine: sinal })));
  assert.equal(resposta.vehicles.length, 3);
});

test("sem turbo, fala direto e oferece os motores mais fortes", async () => {
  const resposta = await perguntar("tem carro turbo?", estoque.filter(v => !["nivus", "hb20s"].includes(v.id)));
  assert.match(resposta.reply, /^Turbo não temos agora\. Separei os mais fortes que temos\./);
  assert.equal(resposta.vehicles.length, 3);
  assert.equal(resposta.vehicles[0]?.id, "civic");
});

test("turbo combina câmbio, preço e carroceria sem negar os demais turbos", async () => {
  const resposta = await perguntar("tem sedan turbo automático até 90 mil?");
  assert.deepEqual(resposta.vehicles.map(v => v.id), ["hb20s"]);
  const vazio = await perguntar("tem turbo manual?");
  assert.match(vazio.reply, /nessa combinação agora.*mais próximas/);
  assert.doesNotMatch(vazio.reply, /^Turbo não temos agora/);
});

for (const mensagem of ["tem carro 1.0 automático?", "tem carro 1,0 automático?", "quero motor 1.0 automático", "tem carro mil automático?"]) {
  test(`cilindrada e câmbio filtram juntos: ${mensagem}`, async () => {
    const resposta = await perguntar(mensagem);
    assert.deepEqual(resposta.vehicles.map(v => v.id), ["hb20s", "nivus"]);
    assert.match(resposta.reply, /motor 1\.0/);
  });
}

test("cilindrada vem do motor ou versão, incluindo 1.0T, e combina preço e carroceria", async () => {
  const resposta = await perguntar("tem sedan 1.0 automático até 90 mil?");
  assert.deepEqual(resposta.vehicles.map(v => v.id), ["hb20s"]);
  for (const motor of ["1.6", "2.0"]) {
    const encontrados = matchedChatStock(`carro motor ${motor} automático`, estoque);
    assert.deepEqual(encontrados.map(v => v.id), [motor === "1.6" ? "hb-auto" : "civic"]);
  }
  const soVersao = carro("so-versao", { engine: null, version: "Comfort 1.0T" });
  assert.deepEqual(matchedChatStock("motor 1.0", [soVersao]).map(v => v.id), ["so-versao"]);
});

test("mil de orçamento ou km e motores mínimos não viram cilindrada exata", () => {
  for (const mensagem of ["carro até 70 mil", "carro com 40 mil km", "tenho mil reais", "carro mil reais", "motor acima de 1.6", "motor no mínimo 1.6", "motor 1.8+", "até 1.0 mil km", "até 2.0k"])
    assert.equal(parseChatDisplacementFilter(mensagem), null, mensagem);
  assert.equal(parseChatDisplacementFilter("carro mil"), 1);
  assert.equal(parseChatDisplacementFilter("motor mil"), 1);
  assert.equal(parseChatDisplacementFilter("motor 1,6"), 1.6);
});

test("combinação sem 1.0 oferece a cilindrada mais próxima mantendo câmbio e teto", async () => {
  const resposta = await perguntar("tem carro 1.0 automático até 60 mil?");
  assert.match(resposta.reply, /Não temos motor 1\.0 nessa combinação agora.*opções mais próximas/);
  assert.deepEqual(resposta.vehicles.map(v => v.id), ["ka", "hb-auto"]);
});

test("custo-benefício equilibra preço, ano e km, com três cards", async () => {
  const fichas = [
    carro("novo-pouco", { price: 50_000, yearModel: 2024, km: 20_000 }),
    carro("novo-muito", { price: 50_000, yearModel: 2024, km: 80_000 }),
    carro("ano-anterior", { price: 50_000, yearModel: 2023, km: 20_000 }),
    carro("antigo-barato", { price: 30_000, yearModel: 2020, km: 20_000 }),
    carro("novo-caro", { price: 120_000, yearModel: 2024, km: 20_000 }),
  ];
  for (const mensagem of ["qual o melhor custo benefício?", "quero o melhor custo-benefício"]) {
    const resposta = await perguntar(mensagem, fichas);
    assert.deepEqual(resposta.vehicles.map(v => v.id), ["novo-pouco", "ano-anterior", "novo-muito"]);
    assert.match(resposta.reply, /Garagem.*preço.*ano.*quilometragem/);
    assert.doesNotMatch(resposta.reply, /lista atual|fontes|Sua Garagem/i);
  }
  const filtrado = await perguntar("melhor custo benefício automático até 40 mil", fichas);
  assert.deepEqual(filtrado.vehicles.map(v => v.id), ["antigo-barato"]);
});

const airbags = [
  carro("mobi", { model: "Mobi", accessories: ["Airbag duplo", "Vidros laterais elétricos"] }),
  carro("city", { model: "City", yearModel: 2018, accessories: ["6 airbags (frontais, laterais e de cortina)"] }),
  carro("kicks", { model: "Kicks", yearModel: 2019, accessories: ["6 Air Bags"] }),
  carro("civic-seis", { model: "Civic", yearModel: 2020, accessories: ["6 Airbags (frontais, laterais e de cortina)"] }),
  carro("seis", { model: "Argo", yearModel: 2023, accessories: ["Seis airbags"] }),
  carro("hrv", { model: "HR-V", yearModel: 2016, accessories: ["Airbags frontais e laterais"] }),
  carro("sem-detalhes"),
];

test("quantidade de airbags conta só confirmações literais e mostra três cards", async () => {
  for (const mensagem of ["tem carro com 6 airbags?", "tem carro com seis airbags?"]) {
    const resposta = await perguntar(mensagem, airbags);
    assert.match(resposta.reply, /^Temos 4 carros com 6 airbags na ficha/);
    assert.deepEqual(resposta.vehicles.map(v => v.id), ["seis", "civic-seis", "kicks"]);
    assert.doesNotMatch(resposta.reply, /não tem|fontes/i);
  }
});

test("airbags laterais e de cortina exigem posições escritas na ficha", async () => {
  const laterais = await perguntar("tem carro com airbags laterais?", airbags);
  assert.match(laterais.reply, /^Temos 3 carros com airbags laterais na ficha/);
  assert.deepEqual(laterais.vehicles.map(v => v.id), ["civic-seis", "city", "hrv"]);
  const cortina = await perguntar("tem carro com airbags de cortina?", airbags);
  assert.match(cortina.reply, /^Temos 2 carros com airbags de cortina na ficha/);
  assert.deepEqual(cortina.vehicles.map(v => v.id), ["civic-seis", "city"]);
  const ambos = await perguntar("tem carro com 6 airbags laterais e de cortina?", airbags);
  assert.deepEqual(ambos.vehicles.map(v => v.id), ["civic-seis", "city"]);
});

test("airbag sem detalhe confirmado encaminha ao consultor e cita as fichas com airbag", async () => {
  for (const fichas of [airbags, airbags.filter(v => ["mobi", "sem-detalhes"].includes(v.id))]) {
    const resposta = await perguntar("tem carro com 8 airbags?", fichas);
    assert.match(resposta.reply, /fichas não detalham 8 airbags.*consultor confirma.*t[eê]m airbags na ficha/);
    assert.doesNotMatch(resposta.reply, /não (?:tem|temos)|nenhum|Sim/i);
    assert.equal(resposta.vehicles.length, Math.min(3, fichas.length - 1));
    assert.ok(resposta.vehicles.every(v => v.id !== "sem-detalhes"));
  }
  const cortina = await perguntar("tem carro com airbags de cortina?", [airbags[0]!]);
  assert.match(cortina.reply, /não detalham airbags de cortina.*Mobi.*tem airbags na ficha/);
});

test("pergunta genérica de airbags preserva airbag duplo e filtros de motor", async () => {
  const resposta = await perguntar("tem carro com airbags?", airbags);
  assert.match(resposta.reply, /^Temos 6 carros com airbags na ficha/);
  assert.equal(resposta.vehicles[0]?.id, "mobi");
  const filtrado = await perguntar("tem carro 1.0 automático com 6 airbags até 70 mil?", [
    airbags[1]!, carro("maior", { engine: "2.0", accessories: ["6 airbags"] }),
  ]);
  assert.deepEqual(filtrado.vehicles.map(v => v.id), ["city"]);
});

test("na ficha de uma unidade, quantidade não detalhada não vira confirmação nem negação", async () => {
  const resposta = await perguntar("o Mobi tem 6 airbags?", airbags);
  assert.match(resposta.reply, /consta airbag duplo.*ficha não detalha 6 airbags.*confirma/i);
  assert.doesNotMatch(resposta.reply, /Sim|não tem|não consta.*airbag/i);
  const confirmado = await perguntar("o City tem 6 airbags?", airbags);
  assert.match(confirmado.reply, /constam 6 airbags/);
  assert.doesNotMatch(confirmado.reply, /não detalha|não tem/i);
});
