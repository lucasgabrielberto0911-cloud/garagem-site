import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGroundedResearch, researchChatVehicles } from "./chat-research";
import { readChatResearch, safeResearchUrl } from "./chat-research-data";
import type { ChatVehicleRecord } from "./chat-stock";
const civic: ChatVehicleRecord = {
  id: "test-civic",
  brand: "Honda",
  model: "Civic",
  version: "LXR 2.0 FlexOne",
  yearModel: 2015,
  km: 106000,
  price: 74900,
  color: "Preto",
  transmission: "Automático",
  fuel: "Flex",
  category: "carro",
};
const supported =
  "Civic LXR 2.0 FlexOne 2015: a potência de catálogo é de 155 cv com etanol.";
const fixture = (
  text = supported,
  url = "https://quatrorodas.abril.com.br/testes/honda-civic-2015/",
) => ({
  candidates: [
    {
      groundingMetadata: {
        groundingChunks: [
          { web: { uri: url, title: "Quatro Rodas — Honda Civic 2015" } },
        ],
        groundingSupports: [{ segment: { text }, groundingChunkIndices: [0] }],
        searchEntryPoint: {
          renderedContent:
            '<a href="https://www.google.com/search?q=Civic+2015" target="_blank">Civic 2015</a>',
        },
      },
    },
  ],
});

test("somente afirmações citadas com modelo, versão e ano corretos entram", () => {
  const result = parseGroundedResearch(fixture(), [civic]);
  assert.equal(result.paragraphs[0]?.text, supported);
  assert.equal(
    result.paragraphs[0]?.sources[0]?.href,
    "https://quatrorodas.abril.com.br/testes/honda-civic-2015/",
  );
  assert.equal(result.unavailable, undefined);
  assert.equal(
    parseGroundedResearch(fixture(supported.replace("2015", "2025")), [civic])
      .unavailable,
    true,
  );
  assert.equal(
    parseGroundedResearch(fixture(supported.replace("LXR", "EXL")), [civic])
      .unavailable,
    true,
  );
  assert.equal(
    parseGroundedResearch(
      { candidates: [{ content: { parts: [{ text: supported }] } }] },
      [civic],
    ).unavailable,
    true,
  );
});

test("fontes inválidas, HTML excessivo e ausência de sugestões não viram pesquisa confirmada", () => {
  for (const url of [
    "http://honda.com.br/manual",
    "https://honda.com.br.evil.test/manual",
    "https://user:pass@honda.com.br/manual",
    "javascript:alert(1)",
    "https://127.0.0.1/manual",
  ])
    assert.equal(safeResearchUrl(url), null);
  assert.equal(
    parseGroundedResearch(fixture(supported, "https://evil.test/manual"), [
      civic,
    ]).unavailable,
    true,
  );
  const data = fixture();
  data.candidates[0]!.groundingMetadata.searchEntryPoint.renderedContent = "";
  assert.equal(parseGroundedResearch(data, [civic]).unavailable, true);
  assert.equal(
    readChatResearch({ paragraphs: [{ text: "texto", sources: null }] }),
    undefined,
  );
});

test("consulta externa usa identidade pública e Google Search; não reenvia preço ou km e não tenta modelo sem fontes", async () => {
  const fetchBefore = globalThis.fetch;
  const keyBefore = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "fixture-local";
  let calls = 0;
  try {
    globalThis.fetch = (async (_url, opts) => {
      calls++;
      const body = JSON.parse(String(opts?.body));
      assert.deepEqual(body.tools, [{ google_search: {} }]);
      const prompt = body.contents[0].parts[0].text;
      assert.match(prompt, /LXR 2.0 FlexOne/);
      assert.match(prompt, /2015/);
      assert.doesNotMatch(prompt, /74900|106000|test-civic/);
      return Response.json(fixture());
    }) as typeof fetch;
    assert.equal((await researchChatVehicles([civic])).paragraphs.length, 1);
    assert.equal(calls, 1);
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(researchChatVehicles([civic], aborted.signal));
    assert.equal(calls, 1);
    globalThis.fetch = (async () => {
      calls++;
      return new Response("{}", { status: 429 });
    }) as typeof fetch;
    assert.equal(
      (await researchChatVehicles([{ ...civic, yearModel: 2016 }])).unavailable,
      true,
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = fetchBefore;
    if (keyBefore === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = keyBefore;
  }
});

test("potência parcial não vira vencedor de todo o estoque e cache mantém recortes separados", () => {
  const partial = parseGroundedResearch(fixture(), [civic], 17);
  assert.match(partial.comparison!.text, /Não consegui confirmar todos/);
  const complete = parseGroundedResearch(fixture(), [civic]);
  assert.equal(complete.comparison, undefined);
  assert.match(complete.paragraphs[0]!.text, /155 cv/);
  assert.deepEqual(complete.powerOrder, [civic.id]);
  assert.equal(partial.powerOrder, undefined);
});

test("potências de um parágrafo comparativo não são atribuídas ao primeiro modelo", () => {
  const duster = {
    ...civic,
    id: "duster",
    brand: "Renault",
    model: "Duster",
    version: "Dynamique 2.0",
    yearModel: 2014,
  };
  for (const text of [
    "Duster Dynamique 2.0 2014: potência de 143 cv com etanol; Civic LXR 2.0 FlexOne 2015: potência de 155 cv com etanol.",
    "Duster Dynamique 2.0 2014: potência de 143 cv com etanol, contra os 155 cv do Civic.",
  ]) {
    const result = parseGroundedResearch(fixture(text), [duster, civic]);
    assert.equal(result.paragraphs.length, 1);
    assert.equal(result.powerOrder, undefined);
    assert.equal(result.comparison, undefined);
  }
});

test("unidades da mesma versão compartilham potência de catálogo sem trocar seus IDs", () => {
  const second = { ...civic, id: "second-civic", km: 120000, price: 70000 };
  const result = parseGroundedResearch(fixture(), [civic, second]);
  assert.deepEqual(result.powerOrder, [civic.id, second.id]);
});

test("cache de pesquisa não retorna IDs de anúncios substituídos", async () => {
  const fetchBefore = globalThis.fetch;
  const keyBefore = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "fixture-local";
  let calls = 0;
  try {
    globalThis.fetch = (async () => {
      calls++;
      return Response.json(fixture(supported.replace("2015", "2017")));
    }) as typeof fetch;
    const first = { ...civic, yearModel: 2017, id: "old-unit" };
    const second = { ...first, id: "replacement-unit" };
    assert.deepEqual((await researchChatVehicles([first])).powerOrder, [
      first.id,
    ]);
    assert.deepEqual((await researchChatVehicles([second])).powerOrder, [
      second.id,
    ]);
    assert.deepEqual((await researchChatVehicles([second])).powerOrder, [
      second.id,
    ]);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = fetchBefore;
    if (keyBefore === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = keyBefore;
  }
});

test("pesquisa atravessa o streaming mas não revive como dado técnico no histórico", async () => {
  const { requestChatReply } = await import("./chat-client-request");
  const { encodeSse } = await import("./chat-stream");
  const { parseChatHistory } = await import("./chat-history");
  const research = parseGroundedResearch(fixture(), [civic]);
  const answer = { reply: "Dados do anúncio", vehicles: [], research };
  const response = await requestChatReply(
    {},
    new AbortController().signal,
    () => {},
    (async () =>
      new Response(encodeSse("done", answer), {
        headers: { "Content-Type": "text/event-stream" },
      })) as typeof fetch,
  );
  assert.deepEqual(
    readChatResearch(response.research),
    readChatResearch(research),
  );
  const now = Date.now();
  const restored = parseChatHistory(
    JSON.stringify({
      v: 3,
      byKey: {
        site: [{ role: "assistant", content: "Dados do anúncio", research }],
      },
      savedAt: { site: now },
    }),
    now,
  );
  assert.equal(restored.byKey.site[0]?.research, undefined);
});

test("evento com fontes longas e sugestões chega inteiro, mantendo limite de transporte", async () => {
  const { requestChatReply } = await import("./chat-client-request");
  const { encodeSse } = await import("./chat-stream");
  const research = {
    paragraphs: Array.from({ length: 16 }, (_, i) => ({
      text: `Modelo ${i}: ` + "texto ".repeat(100),
      sources: Array.from({ length: 3 }, (_, j) => ({
        title: `Fonte ${j}`,
        href:
          "https://honda.com.br/" +
          String(i) +
          "/" +
          String(j) +
          "x".repeat(1800),
      })),
    })),
    suggestionsHtml: "<p>Google</p>" + " ".repeat(29000),
  };
  const event = encodeSse("done", { reply: "Consulta concluída", research });
  assert.ok(event.length > 64000 && event.length < 256000);
  const response = await requestChatReply(
    {},
    new AbortController().signal,
    () => {},
    (async () =>
      new Response(event, {
        headers: { "Content-Type": "text/event-stream" },
      })) as typeof fetch,
  );
  assert.equal(readChatResearch(response.research)?.paragraphs.length, 16);
  await assert.rejects(
    requestChatReply(
      {},
      new AbortController().signal,
      () => {},
      (async () =>
        new Response("x".repeat(256001), {
          headers: { "Content-Type": "text/event-stream" },
        })) as typeof fetch,
    ),
  );
});

test("fontes divergentes para o mesmo combustível não elegem um vencedor", () => {
  const data = fixture();
  data.candidates[0]!.groundingMetadata.groundingSupports.push({ segment: { text: supported.replace("155 cv", "150 cv") }, groundingChunkIndices: [0] });
  const result = parseGroundedResearch(data, [civic]);
  assert.equal(result.powerOrder, undefined);
  assert.match(result.comparison!.text, /divergentes/);
  assert.equal(result.paragraphs.length, 2);
});

test("potência de outro combustível não apaga a maior documentada nem vira conflito", () => {
  const data = fixture();
  data.candidates[0]!.groundingMetadata.groundingSupports.push({ segment: { text: supported.replace("155 cv", "150 cv").replace("etanol", "gasolina") }, groundingChunkIndices: [0] });
  const result = parseGroundedResearch(data, [civic]);
  assert.deepEqual(result.powerOrder, [civic.id]);
  assert.equal(result.comparison, undefined);
});

test("rótulo combinado sem combustível por valor não cria ranking e conflito parcial é detectado", () => {
  assert.equal(parseGroundedResearch(fixture(supported.replace("155 cv com etanol", "150/155 cv (gasolina/etanol)")), [civic]).powerOrder, undefined);
  const data = fixture(supported.replace("155 cv com etanol", "155 cv com etanol e 150 cv com gasolina"));
  data.candidates[0]!.groundingMetadata.groundingSupports.push({ segment: { text: supported.replace("155 cv", "160 cv") }, groundingChunkIndices: [0] });
  assert.equal(parseGroundedResearch(data, [civic]).powerOrder, undefined);
  assert.match(parseGroundedResearch(data, [civic]).comparison!.text, /divergentes/);
});
