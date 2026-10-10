import assert from "node:assert/strict";
import { test } from "node:test";
import { JEV_ENDPOINT, JEV_MODEL } from "./jev";
import {
  judgeListingQuality,
  LISTING_QUESTIONS,
  parseListingDraft,
  parseListingJudgment,
} from "./listing-quality";
import type { ListingDraft } from "./listing-present";

const draft: ListingDraft = {
  brand: "Honda",
  model: "Civic",
  version: "EXL",
  year: "2020",
  yearModel: "2021",
  km: "45000",
  transmission: "Automático",
  fuel: "Flex",
  color: "Prata",
  price: 98900,
  description: "Único dono, revisões feitas, sem detalhe de funilaria.",
  accessories: ["Ar-condicionado", "Multimídia"],
  photoCount: 8,
  status: "disponivel",
  category: "carro",
};

test("sem chave o anúncio não ganha nota e a rede não é chamada", async () => {
  const previous = process.env.JEV_API_KEY;
  delete process.env.JEV_API_KEY;
  try {
    let called = false;
    const result = await judgeListingQuality(draft, {
      fetchImpl: async () => {
        called = true;
        throw new Error("não deveria chamar");
      },
    });
    assert.equal(result, null);
    assert.equal(called, false);
  } finally {
    if (previous === undefined) delete process.env.JEV_API_KEY;
    else process.env.JEV_API_KEY = previous;
  }
});

test("falha da API não gera nota e não estoura", async () => {
  const result = await judgeListingQuality(draft, {
    apiKey: "segredo-teste",
    fetchImpl: async () => {
      throw new Error("timeout");
    },
  });
  assert.equal(result, null);

  const http = await judgeListingQuality(draft, {
    apiKey: "segredo-teste",
    fetchImpl: async () => new Response("erro", { status: 502 }),
  });
  assert.equal(http, null);
});

test("uma chamada junta legenda, opcionais e foco", async () => {
  let seenBody = "";
  const result = await judgeListingQuality(draft, {
    apiKey: "segredo-teste",
    fetchImpl: async (url, init) => {
      assert.equal(String(url), JEV_ENDPOINT);
      seenBody = String(init?.body ?? "");
      return Response.json({
        answers: {
          legenda: {
            type: "score",
            score: 1.9,
            confidence: 0.77,
            legend: { "0": "fraco", "3": "ótimo" },
          },
          opcionais_fracos: { type: "noul", noul: 0.81 },
          foco: { type: "choice", choice: "legenda", confidence: 0.6 },
        },
        usage: { input_tokens: 120, output_tokens: 8 },
      });
    },
  });

  const body = JSON.parse(seenBody) as {
    model: string;
    state: string;
    questions: Record<string, { type: string }>;
  };
  assert.equal(body.model, JEV_MODEL);
  assert.equal(body.state.includes("placa"), false);
  assert.equal(body.questions.legenda.type, "score");
  assert.equal(body.questions.opcionais_fracos.type, "noul");
  assert.equal(body.questions.foco.type, "choice");
  assert.deepEqual(Object.keys(body.questions).sort(), Object.keys(LISTING_QUESTIONS).sort());
  assert.equal(result?.captionScore, 1.9);
  assert.equal(result?.captionConfidence, 0.77);
  assert.equal(result?.thinOptions, 0.81);
  assert.equal(result?.focus, "legenda");
});

test("vendido e anúncio sem nome não consultam o Jev", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    throw new Error("não deveria chamar");
  };
  assert.equal(
    await judgeListingQuality({ ...draft, status: "vendido" }, { apiKey: "x", fetchImpl }),
    null,
  );
  assert.equal(
    await judgeListingQuality({ ...draft, brand: " ", model: "" }, { apiKey: "x", fetchImpl }),
    null,
  );
  assert.equal(called, false);
});

test("resposta sem score de legenda não vira nota", () => {
  assert.equal(parseListingJudgment({ foco: { choice: "nada" } }), null);
  assert.equal(
    parseListingJudgment({ legenda: { score: Number.NaN } }),
    null,
  );
});

test("o corpo aceita o rascunho e descarta fotoCount inválido", () => {
  const parsed = parseListingDraft({ ...draft, plate: "ABC1D23", locationCity: "serra" });
  assert.equal(parsed?.brand, "Honda");
  assert.equal("plate" in (parsed ?? {}), false);
  assert.equal(parseListingDraft({ ...draft, photoCount: "8" }), null);
  assert.equal(parseListingDraft({ ...draft, status: "apagado" }), null);
});
