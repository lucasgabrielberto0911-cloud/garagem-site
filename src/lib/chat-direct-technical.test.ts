import assert from "node:assert/strict";
import test from "node:test";
import { runChatTurn } from "./chat-turn";
import { researchChatVehicles, chatResearchTopic, parseGroundedResearch } from "./chat-research";
import { technicalReference, DUSTER_CATALOG_SOURCE } from "./chat-technical-reference";
import { safeResearchUrl } from "./chat-research-data";
import type { ChatVehicleRecord } from "./chat-stock";

// Public identity only; test prices/km are local fixtures, never published.
const duster: ChatVehicleRecord = { id: "test-duster", brand: "Renault", model: "Duster", version: "Dynamique 2.0 16V Tech Road 2", yearModel: 2014, engine: "2.0 16V Hi-Flex", transmission: "Automático", fuel: "Flex", price: 54900, km: 101000, color: "Prata", category: "carro" };
const civic = { ...duster, id: "civic", brand: "Honda", model: "Civic", version: "LXR 2.0 FlexOne", yearModel: 2015 };
const noModel = async () => { throw Error("não precisa do modelo de linguagem"); };

for (const question of ["quantos cv tem a duster?", "qual a potência da Duster?", "quantos cavalos ela tem?"]) test(`pergunta direta: ${question}`, async () => {
  const streamed: string[] = [];
  const result = await runChatTurn({ mensagem: question, historico: question.includes("ela") ? [{ role: "user", content: "quero saber da Duster" }] : [], stock: [duster, civic], vehicleId: "civic", onToken: text => streamed.push(text), generate: noModel });
  assert.equal(result.meta?.policy, "spec-direct");
  assert.match(result.reply, /142 cv no etanol e 138 cv na gasolina/);
  assert.doesNotMatch(result.reply, /mais potente|Achei|No estoque|54\.900|101 mil|kgfm/);
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), [duster.id]);
  assert.equal(streamed.join(""), result.reply);
});

test("a ficha de referência bate com o catálogo revisado e não faz chamada paga", async () => {
  const before = globalThis.fetch; let called = false;
  try {
    globalThis.fetch = (async () => { called = true; throw Error("must not fetch"); }) as typeof fetch;
    assert.match((await researchChatVehicles([duster], undefined, "potência")).paragraphs[0]!.text, /142 cv/);
    assert.equal(called, false);
  } finally { globalThis.fetch = before; }
  for (const changed of [{ yearModel: 2020 }, { brand: "Dacia" }, { engine: "1.6" }, { version: "Intense 1.3 turbo" }, { transmission: "Manual" }, { fuel: "Diesel" }]) assert.equal(technicalReference({ ...duster, ...changed }, "potência"), null);
  assert.equal(technicalReference(duster, "consumo"), null);
  assert.match(technicalReference(duster, "torque")!.paragraphs[0]!.text, /20,9 kgfm.*19,7 kgfm/);
  assert.doesNotMatch(technicalReference(duster, "torque")!.paragraphs[0]!.text, /cv/);
  assert.equal(chatResearchTopic("quantos cv?"), "potência");
  assert.equal(chatResearchTopic("quanto torque tem?"), "torque");
  assert.equal(safeResearchUrl(DUSTER_CATALOG_SOURCE), DUSTER_CATALOG_SOURCE);
  assert.equal(safeResearchUrl("https://ptdocz.com/doc/outro-documento"), null);
});

test("dois Civic no estoque: responde os dois, com o ano, sem misturar os números", async () => {
  const stock = [civic, { ...civic, id: "civic2020", version: "EXL 2.0 FLEX 16v", yearModel: 2020 }, duster];
  const result = await runChatTurn({ mensagem: "quantos cv tem o Civic?", historico: [], stock, generate: noModel });
  assert.equal(result.meta?.policy, "spec-direct");
  assert.match(result.reply, /Civic 2\.0 2015 tem cerca de 155 cv/);
  assert.match(result.reply, /Civic 2\.0 2020 tem cerca de 155 cv/);
  assert.doesNotMatch(result.reply, /142 cv|Achei|R\$/);
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id).sort(), ["civic", "civic2020"]);
});

test("ano e versão pedidos prevalecem sobre outra ficha aberta", async () => {
  const newer = { ...civic, id: "civic2020", version: "EXL 2.0 FLEX 16v", yearModel: 2020 };
  for (const [question, activeId, expected] of [
    ["quantos cv tem o Civic 2020?", civic.id, newer],
    ["quantos cv tem o Civic LXR?", newer.id, civic],
    ["quantos cv tem a Duster ano 2014?", civic.id, duster],
    ["qual a potência da Duster de 2014?", civic.id, duster],
    ["qual a potência da Duster 2013/2014?", civic.id, duster],
    ["qual a potência da Duster ano 2013/2014?", civic.id, duster],
  ] as const) {
    const result = await runChatTurn({ mensagem: question, historico: [], stock: [civic, newer, duster], vehicleId: activeId, generate: noModel });
    assert.equal(result.meta?.policy, "spec-direct", question);
    assert.deepEqual(result.vehicles.map(v => v.id).filter(id => id !== activeId), [expected.id].filter(id => id !== activeId), question);
    assert.doesNotMatch(result.reply, /mais potente|Achei/, question);
  }
});

test("motor ou ano sem correspondência nunca reaproveita a potência de outra unidade", async () => {
  for (const question of ["quantos cv tem a Duster 1.6?", "quantos cv tem a Duster 2030?", "quantos cv tem a Duster ano 2030?"]) {
    let prompt = "";
    const result = await runChatTurn({ mensagem: question, historico: [], stock: [duster, civic], vehicleId: duster.id,
      generate: async ({ systemPrompt }) => { prompt = systemPrompt; return { text: "Dessa versão eu não tenho o número exato aqui; no estoque tenho a Duster 2.0 2014.", functionCall: null }; } });
    assert.equal(result.meta?.policy, "expert", question);
    assert.match(prompt, /versão ou ano que o estoque não tem/, question);
    assert.doesNotMatch(prompt, /FICHAS TÉCNICAS DE REFERÊNCIA/, question);
    assert.doesNotMatch(prompt, /142 cv/, question);
    assert.equal(result.vehicles.length, 0, question);
    // Sem o modelo de linguagem, a reserva também não usa a ficha de outra versão.
    const offline = await runChatTurn({ mensagem: question, historico: [], stock: [duster, civic], vehicleId: duster.id, generate: noModel });
    assert.doesNotMatch(offline.reply, /142 cv|138 cv/, question);
    assert.match(offline.reply, /Duster Dynamique 2\.0 16V Tech Road 2 2014/, question);
  }
});

test("números de potência e aceleração não viram cilindrada de moto", async () => {
  const bike = { ...duster, id: "bike", brand: "Honda", model: "Biz", version: "ES 125", engine: "125cc", category: "moto", yearModel: 2023, transmission: "Semi-automático" };
  const power = await runChatTurn({ mensagem: "essa Biz tem 150 cv?", historico: [], stock: [bike], vehicleId: bike.id, generate: noModel });
  assert.equal(power.meta?.policy, "spec-direct");
  assert.match(power.reply, /Biz 125 tem cerca de 9,2 cv/);
  assert.doesNotMatch(power.reply, /150 cv/);
  const accel = await runChatTurn({ mensagem: "essa Biz faz de 0 a 100 em quanto tempo?", historico: [], stock: [bike], vehicleId: bike.id,
    generate: async () => ({ text: "Moto de 125 cc não é feita para isso: o 0 a 100 dela não é um número que a Honda divulga.", functionCall: null }) });
  assert.equal(accel.meta?.policy, "expert");
});

test("0 a 100 é aceleração, não teto de preço do anúncio", async () => {
  const expensive = { ...civic, price: 180000 };
  const result = await runChatTurn({ mensagem: "esse Civic faz de 0 a 100 em quanto tempo?", historico: [], stock: [expensive], vehicleId: expensive.id, generate: noModel });
  assert.equal(result.meta?.policy, "spec-direct");
  assert.match(result.reply, /0 a 100 km\/h em cerca de 10,9 segundos/);
  assert.doesNotMatch(result.reply, /100\.000|180\.000|barato|Achei/);
  assert.equal(result.vehicles.length, 0, "o carro aberto na tela não vira card repetido");
});

test("citação de uma frase usa seu cabeçalho exato sem aceitar outra versão/ano ou outro parágrafo", () => {
  const claim = "A potência é de 155 cv com etanol.";
  function fixture(heading: string, text = claim) {
    return { candidates: [{ content: { parts: [{ text: `${heading}\n\n${text}` }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://honda.com.br/catalogo", title: "Honda — catálogo" } }], groundingSupports: [{ segment: { text }, groundingChunkIndices: [0] }], searchEntryPoint: { renderedContent: "<div>Pesquisa Google</div>" } } }] };
  }
  const result = parseGroundedResearch(fixture("## Civic LXR 2.0 FlexOne 2015"), [civic]);
  assert.match(result.paragraphs[0]!.text, /Civic.*155 cv/);
  assert.deepEqual(result.powerOrder, [civic.id]);
  for (const heading of ["Civic EXL 2.0 2015", "Civic LXR 2.0 FlexOne 2020", "Civic LXR 2.0 FlexOne 2015 — 180cv com etanol", "Civic LXR 2.0 FlexOne 2015\n\nOutro parágrafo sem identidade"])
    assert.equal(parseGroundedResearch(fixture(heading), [civic]).unavailable, true);
  assert.equal(parseGroundedResearch(fixture("Civic LXR 2.0 FlexOne 2015", "Civic EXL 2020 tem 155 cv com etanol."), [civic]).unavailable, true);
});
