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

for (const question of ["quantos cv tem a duster?", "qual a potência da Duster?", "quantos cavalos ela tem?"]) test(`pergunta direta: ${question}`, async () => {
  const streamed: string[] = [];
  const result = await runChatTurn({ mensagem: question, historico: question.includes("ela") ? [{ role: "user", content: "quero saber da Duster" }] : [], stock: [duster, civic], vehicleId: "civic", onToken: text => streamed.push(text), generate: async () => { throw Error("must not generate"); } });
  assert.equal(result.meta?.policy, "technical-research");
  assert.match(result.reply, /142 cv com etanol e 138 cv com gasolina/);
  assert.doesNotMatch(result.reply, /mais potente|Achei|54\.900|101 mil|torque/);
  assert.deepEqual(result.vehicles.map(vehicle => vehicle.id), [duster.id]);
  assert.ok(result.research?.paragraphs[0]?.sources.some(source => source.href === DUSTER_CATALOG_SOURCE));
  assert.equal(streamed.join(""), result.reply);
});

test("referência conferida não faz chamada paga e não vale para outro motor, ano, marca ou versão", async () => {
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

test("mais de uma versão pede identificação; ausência de fonte não vira comparação ou potência inventada", async () => {
  const stock = [civic, { ...civic, id: "civic2020", version: "EXL 2.0 FLEX 16v", yearModel: 2020 }, duster];
  const missing = async () => ({ paragraphs: [], unavailable: true });
  const ambiguous = await runChatTurn({ mensagem: "quantos cv tem o Civic?", historico: [], stock, research: missing });
  assert.equal(ambiguous.meta?.policy, "technical-version-ask");
  assert.match(ambiguous.reply, /2015.*2020.*qual delas/i);
  const focused = await runChatTurn({ mensagem: "quantos cv tem esse Civic?", historico: [], stock, vehicleId: civic.id, research: missing });
  assert.match(focused.reply, /confirmar a potência/);
  assert.doesNotMatch(focused.reply, /mais potente|\d+ cv|Achei|R\$/);
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
    let researched: string[] = [];
    const result = await runChatTurn({ mensagem: question, historico: [], stock: [civic, newer, duster], vehicleId: activeId,
      research: async vehicles => { researched = vehicles.map(v => v.id); return { paragraphs: [], unavailable: true }; } });
    assert.equal(result.meta?.policy, "technical-research", question);
    assert.deepEqual(researched, [expected.id], question);
    assert.deepEqual(result.vehicles.map(v => v.id), [expected.id], question);
    assert.doesNotMatch(result.reply, /mais potente|Achei/, question);
  }
});

test("motor ou ano sem correspondência nunca reaproveita a potência de outra unidade", async () => {
  for (const question of ["quantos cv tem a Duster 1.6?", "quantos cv tem a Duster 2030?", "quantos cv tem a Duster ano 2030?", "quantos cv tem esse carro 1.6?"]) {
    const result = await runChatTurn({ mensagem: question, historico: [], stock: [duster, civic], vehicleId: duster.id,
      research: async () => { throw Error("must not research a different identity"); } });
    assert.equal(result.meta?.policy, "technical-identity-ask", question);
    assert.match(result.reply, /versão e o ano completos/, question);
    assert.equal(result.vehicles.length, 0, question);
    assert.doesNotMatch(result.reply, /142 cv|138 cv/, question);
  }
});

test("números de potência e aceleração não viram cilindrada de moto", async () => {
  const bike = { ...duster, id: "bike", brand: "Honda", model: "Biz", version: "ES 125", engine: "125cc", category: "moto" };
  for (const question of ["essa Biz tem 150 cv?", "essa Biz faz de 0 a 100 em quanto tempo?"]) {
    let researched: string[] = [];
    const result = await runChatTurn({ mensagem: question, historico: [], stock: [bike], vehicleId: bike.id,
      research: async vehicles => { researched = vehicles.map(v => v.id); return { paragraphs: [], unavailable: true }; } });
    assert.equal(result.meta?.policy, "technical-research", question);
    assert.deepEqual(researched, [bike.id], question);
  }
});

test("0 a 100 é aceleração, não teto de preço do anúncio", async () => {
  const expensive = { ...civic, price: 180000 };
  let researched: string[] = [];
  const result = await runChatTurn({ mensagem: "esse Civic faz de 0 a 100 em quanto tempo?", historico: [], stock: [expensive], vehicleId: expensive.id,
    research: async vehicles => { researched = vehicles.map(v => v.id); return { paragraphs: [], unavailable: true }; } });
  assert.equal(result.meta?.policy, "technical-research");
  assert.deepEqual(researched, [expensive.id]);
  assert.doesNotMatch(result.reply, /100\.000|barato|Achei/);
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
