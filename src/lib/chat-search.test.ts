import assert from "node:assert/strict";
import { test } from "node:test";
import { runChatTurn } from "./chat-turn";
import { parsePriceLimit } from "./chat-prompt";
import { parseChatSearchRanges } from "./chat-search-filters";
import {
  asksAboutNamedGear,
  isFocusedVehicleFactQuestion,
  scopeChatMessage,
  searchChatInventory,
  type ChatVehicleRecord,
} from "./chat-stock";
import { loadChatStock } from "./chat-stock";
import { prisma } from "./prisma";
import { chatStockExploreHref } from "./chat-cards";
import { resolveChatRequestVehicleId } from "./chat-text";

const car = (
  id: string,
  model: string,
  engine: string,
  price: number,
  km: number,
  yearModel = 2015,
  transmission = "Automático",
): ChatVehicleRecord => ({
  id,
  brand: "Teste",
  model,
  version: `Versão ${engine}`,
  engine,
  price,
  km,
  yearModel,
  transmission,
  category: "carro",
  color: "Preto",
  fuel: "Flex",
});
const stock = [
  car("hb", "HB20", "1.6", 49900, 127300),
  car("civic", "Civic", "2.0", 74900, 106000),
  car("duster", "Duster", "2.0", 54900, 101000, 2014),
  car("hrv", "HR-V", "1.8", 84900, 103000, 2016),
  car("manual", "Manual teste", "2.4", 45000, 50000, 2018, "Manual"),
  {
    ...car("moto", "BIZ", "0.125", 14900, 3000, 2023, "Semi-automático"),
    category: "moto",
  },
];
const noResearch = async () => ({ paragraphs: [], unavailable: true as const });

for (const message of [
  "qual automatico mais forte?",
  "quais automáticos mais potentes?",
  "qual automtico mais forte?",
  "automático forte até 80 mil",
]) {
  test(`busca por força não vira confirmação de câmbio: ${message}`, async () => {
    assert.equal(asksAboutNamedGear(message), false);
    assert.equal(isFocusedVehicleFactQuestion(message, stock, "hb"), false);
    let modelCalls = 0;
    const reply = await runChatTurn({
      mensagem: message,
      historico: [],
      stock,
      vehicleId: "hb",
      research: noResearch,
      generate: async () => {
        modelCalls++;
        return { text: "Sim — o HB20 é Automático." };
      },
    });
    assert.equal(modelCalls, 0);
    assert.equal(reply.vehicles[0]?.id, "duster");
    assert.deepEqual(
      reply.vehicles.map((v) => v.id),
      ["duster", "civic", "hrv"]
        .filter((id) => !message.includes("80 mil") || id !== "hrv")
        .concat(message.includes("80 mil") ? ["hb"] : []),
    );
    assert.ok(
      reply.vehicles.every(
        (v) =>
          v.category === "carro" && /automático/i.test(v.transmission ?? ""),
      ),
    );
    assert.doesNotMatch(reply.reply, /Sim.*HB20|é o mais forte|\d+\s*cv/);
    assert.match(reply.reply, /cilindrada sozinha não confirma/);
  });
}

test("uma pergunta factual sobre o HB20 continua falando só dele", async () => {
  const reply = await runChatTurn({
    mensagem: "o HB20 é automático?",
    historico: [],
    stock,
  });
  assert.deepEqual(
    reply.vehicles.map((v) => v.id),
    ["hb"],
  );
  assert.match(reply.reply, /HB20.*Automático/);
});

test("a ficha não prende uma nova pesquisa no carro aberto", () => {
  assert.equal(
    resolveChatRequestVehicleId({
      mensagem: "qual automático mais forte?",
      pageVehicleId: "hb",
    }),
    undefined,
  );
  assert.equal(
    resolveChatRequestVehicleId({
      mensagem: "esse é automático?",
      pageVehicleId: "hb",
    }),
    "hb",
  );
});

test("comparação preserva carros e teto depois de pergunta sobre garantia", async () => {
  const mensagem =
    "Compare as opções para uso na cidade e na estrada, considerando só preço, km e câmbio cadastrados.";
  const historico = [
    { role: "user" as const, content: "Carros até 80 mil?" },
    { role: "assistant" as const, content: "Opções disponíveis." },
    { role: "user" as const, content: "Qual a garantia?" },
  ];
  const scoped = scopeChatMessage(mensagem, historico, stock);
  assert.match(scoped, /80 mil/);
  assert.match(scoped, /carro/);
  const reply = await runChatTurn({
    mensagem,
    historico,
    stock,
    research: noResearch,
  });
  assert.ok(reply.vehicles.length > 0);
  assert.ok(
    reply.vehicles.every((v) => v.category === "carro" && v.price <= 80000),
  );
});

test("nova busca mais forte não herda um modelo único anterior", () => {
  const text = scopeChatMessage(
    "qual automático mais forte?",
    [{ role: "user", content: "quero HB20 até 80 mil" }],
    stock,
  );
  assert.doesNotMatch(text, /HB20/i);
  assert.match(text, /80 mil/);
});

test("km, ano, cilindrada e parcelas não viram preço", () => {
  for (const text of [
    "até 80 mil km",
    "até 2018",
    "ano 2015",
    "motor 2.0",
    "em 60x",
  ])
    assert.equal(parsePriceLimit(text), null, text);
  assert.equal(
    parsePriceLimit("até 90 mil, com até 80 mil km, a partir de 2015"),
    90000,
  );
  assert.equal(parsePriceLimit("até 80 mil km, preço até R$ 74.990"), 74990);
  assert.equal(parsePriceLimit("entre 50 e 80 mil"), 80000);
});

test("ano, km e intervalo de preço filtram juntos, e link pode manter filtros", () => {
  assert.deepEqual(
    parseChatSearchRanges(
      "automático de 2015 a 2018, até 110 mil km, entre 50 e 85 mil",
    ),
    { minYear: 2015, maxYear: 2018, maxKm: 110000, minPrice: 50000 },
  );
  const found = searchChatInventory(
    "automático de 2015 a 2018, até 110 mil km, entre 50 e 85 mil",
    stock,
  );
  assert.deepEqual(
    found?.picks.map((v) => v.id),
    ["civic", "hrv"],
  );
});

test("refinar por ano/km mantém exatamente orçamento e categoria da conversa", () => {
  const scoped = scopeChatMessage(
    "qual o mais novo?",
    [
      {
        role: "user",
        content:
          "carro automático até R$ 74.990, a partir de 2015, até 110 mil km",
      },
    ],
    stock,
  );
  assert.equal(parsePriceLimit(scoped), 74990);
  assert.deepEqual(
    searchChatInventory(scoped, stock)?.picks.map((v) => v.id),
    ["civic"],
  );
});

test("menos km e mais novo ordenam pelo fato pedido", () => {
  assert.equal(
    searchChatInventory("carro automático com menos km", stock)?.picks[0]?.id,
    "duster",
  );
  assert.equal(
    searchChatInventory("automático mais novo", stock)?.picks[0]?.id,
    "hrv",
  );
});

test("pesquisa não desvia cadastro de contato para resposta determinística", async () => {
  let calls = 0;
  const result = await runChatTurn({
    mensagem:
      "Quero o automático mais forte. Meu nome é Ana Souza, telefone 27988887777",
    historico: [],
    stock,
    research: noResearch,
    generate: async () => {
      calls++;
      return {
        text: "",
        functionCall: {
          name: "criar_lead",
          args: {
            nome: "Ana Souza",
            telefone: "27988887777",
            mensagem: "Interesse",
          },
        },
      };
    },
    createLead: async () => ({ id: "local-fixture" }),
    confirm: async () => "Contato registrado.",
  });
  assert.equal(calls, 1);
  assert.equal(result.leadCreated, true);
});

test("cidade e intervalos continuam no caminho para o estoque", () => {
  const located = stock.map((v, i) => ({
    ...v,
    locationCity: i % 2 ? "serra" : "aracruz",
  }));
  const found = searchChatInventory(
    "carro automático em Aracruz a partir de 2015 até 110 mil km",
    located,
  );
  assert.equal(found, null);
  const href = chatStockExploreHref(
    "carro automático em Serra, a partir de 2015, até 110 mil km",
    located,
    0,
  );
  assert.ok(href);
  const query = new URL(href!, "https://www.suagaragem.net").searchParams;
  assert.equal(query.get("city"), "serra");
  assert.equal(query.get("minYear"), "2015");
  assert.equal(query.get("maxKm"), "110000");
});

test("busca não perde anúncios depois do antigo teto de 80", async () => {
  const original = prisma.vehicle.findMany;
  let calls = 0;
  const fixture = Array.from({ length: 83 }, (_, i) => ({
    ...car(
      `fixture-${i.toString().padStart(3, "0")}`,
      `Carro ${i}`,
      "1.6",
      50000,
      10000,
    ),
    locationCity: "serra",
    photos: [],
  }));
  try {
    prisma.vehicle.findMany = (async (args: unknown) => {
      calls++;
      const query = args as {
        where: Record<string, unknown>;
        cursor?: { id: string };
        take: number;
      };
      assert.equal(query.where.status, "disponivel");
      assert.equal(query.where.historical, false);
      const start = query.cursor
        ? fixture.findIndex((v) => v.id === query.cursor!.id) + 1
        : 0;
      return fixture.slice(start, start + query.take);
    }) as typeof original;
    const rows = await loadChatStock();
    assert.equal(rows.length, 83);
    assert.equal(rows.at(-1)?.id, "fixture-082");
    assert.equal(calls, 2);
  } finally {
    prisma.vehicle.findMany = original;
  }
});

test("tirar um filtro vale para esta mensagem e as próximas", () => {
  const historico = [
    {
      role: "user" as const,
      content:
        "carro automático até 80 mil em Serra a partir de 2015 até 110 mil km",
    },
  ];
  const reset = scopeChatMessage(
    "quero o mais forte, sem teto e qualquer câmbio, qualquer cidade",
    historico,
    stock,
  );
  assert.equal(parsePriceLimit(reset), null);
  assert.doesNotMatch(reset, /em serra|automático/i);
  historico.push({
    role: "user",
    content: "sem teto, qualquer câmbio, qualquer cidade",
  });
  const next = scopeChatMessage("qual o mais novo?", historico, stock);
  assert.equal(parsePriceLimit(next), null);
  assert.doesNotMatch(next, /em serra|automático/i);
  const yearReset = scopeChatMessage(
    "quero mais forte, sem limite de ano",
    historico.slice(0, 1),
    stock,
  );
  assert.equal(parsePriceLimit(yearReset), 80000);
  assert.equal(parseChatSearchRanges(yearReset).minYear, undefined);
});

test("consumo não vira seleção genérica e não publica estimativa sem fonte", async () => {
  const result = await runChatTurn({
    mensagem: "Qual consumo desse carro?",
    historico: [],
    stock,
    vehicleId: "civic",
    research: noResearch,
    generate: async () => {
      throw new Error("não deveria usar resposta sem pesquisa");
    },
  });
  assert.equal(result.meta?.policy, "technical-research");
  assert.equal(result.vehicles[0]?.id, "civic");
  assert.equal(result.research?.unavailable, true);
  assert.doesNotMatch(result.reply, /km\/l|faixa típica/);
});

test("consumo sem modelo pede identificação em vez de estimar números", async () => {
  const result = await runChatTurn({
    mensagem: "quanto faz por litro?",
    historico: [],
    stock,
    research: noResearch,
  });
  assert.equal(result.meta?.policy, "technical-ask");
  assert.equal(result.vehicles.length, 0);
  assert.doesNotMatch(result.reply, /\d.*km\/l/);
});

test("potência documentada completa corrige a ordem dos cards sem trocar os filtros", async () => {
  const { parseGroundedResearch } = await import("./chat-research");
  const result = await runChatTurn({
    mensagem: "qual automático mais forte até 80 mil?",
    historico: [],
    stock,
    research: async (vehicles) =>
      parseGroundedResearch(
        {
          candidates: [
            {
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      uri: "https://honda.com.br/catalogo-fixture",
                      title: "Catálogo simulado para teste",
                    },
                  },
                ],
                groundingSupports: vehicles.map((v) => ({
                  segment: {
                    text: `${v.model} ${v.version} ${v.yearModel}: potência de catálogo ${v.id === "civic" ? 155 : v.id === "duster" ? 143 : 128} cv com etanol.`,
                  },
                  groundingChunkIndices: [0],
                })),
                searchEntryPoint: {
                  renderedContent:
                    '<a href="https://www.google.com/search">Google</a>',
                },
              },
            },
          ],
        },
        vehicles,
      ),
  });
  assert.deepEqual(
    result.vehicles.map((v) => v.id),
    ["civic", "duster", "hb"],
  );
  assert.match(result.reply, /potência de catálogo confirmada/);
  assert.match(result.research!.comparison!.text, /Civic.*155 cv/);
  assert.doesNotMatch(result.reply, /HR-V/);
});

test("atalho de uma pesquisa por modelo preserva versão e não abre todo o estoque", async () => {
  const many = Array.from({ length: 4 }, (_, i) => ({
    ...stock[1]!,
    id: `civic-${i}`,
    brand: "Honda",
    version: "LXR 2.0 FlexOne",
  }));
  const result = await runChatTurn({
    mensagem: "Honda Civic LXR automático até 80 mil",
    historico: [],
    stock: [...many, ...stock],
    research: noResearch,
  });
  assert.ok(result.stockHref);
  const params = new URL(result.stockHref!, "https://www.suagaragem.net")
    .searchParams;
  assert.equal(params.get("brand"), "Honda");
  assert.equal(params.get("model"), "Civic");
  assert.equal(params.get("q"), "lxr");
  const single = await runChatTurn({
    mensagem: "HB20 automático até 80 mil",
    historico: [],
    stock,
    research: noResearch,
  });
  assert.equal(single.stockHref, null);
});

test("qualquer câmbio com força mantém orçamento e não vira aula de transmissão", async () => {
  const result = await runChatTurn({
    mensagem: "qual o mais forte, manual ou automático?",
    historico: [{ role: "user", content: "carros até 80 mil" }],
    stock,
    research: noResearch,
  });
  assert.equal(result.meta?.policy, "inventory-search");
  assert.equal(result.research?.unavailable, true);
  assert.ok(result.vehicles.every((v) => v.price <= 80000));
  assert.ok(result.vehicles.some((v) => v.transmission === "Manual"));
});

test("pergunta técnica junto com financiamento mantém pesquisa com fontes", async () => {
  for (const mensagem of [
    "qual automático mais forte para financiar?",
    "qual o consumo do Civic para financiar?",
  ]) {
    const result = await runChatTurn({
      mensagem,
      historico: [],
      stock,
      research: noResearch,
      generate: async () => {
        throw new Error("não responder por estimativa");
      },
    });
    assert.equal(result.research?.unavailable, true);
    assert.doesNotMatch(result.reply, /\d.*(?:km\/l|cv)/);
    assert.ok(result.vehicles.length > 0);
  }
});

test("modelo ausente citado na pergunta técnica não vira pesquisa do carro da ficha aberta", async () => {
  let researchCalls = 0;
  const result = await runChatTurn({
    mensagem: "qual a potência do Corolla?",
    historico: [],
    stock,
    vehicleId: "civic",
    research: async () => {
      researchCalls++;
      return noResearch();
    },
  });
  assert.equal(researchCalls, 0);
  assert.equal(result.vehicles.length, 0);
  assert.match(result.reply, /modelo, versão e ano/);
  assert.doesNotMatch(result.reply, /Civic/);
});
