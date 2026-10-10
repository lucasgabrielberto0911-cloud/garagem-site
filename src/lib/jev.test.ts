import assert from "node:assert/strict";
import { test } from "node:test";
import { askJev, JEV_ENDPOINT, JEV_MODEL, type JevQuestion } from "./jev";

const questions: Record<string, JevQuestion> = {
  legenda: {
    type: "score",
    instructions: "Avalie a legenda.",
    criteria: ["fraco", "ok", "bom", "ótimo"],
  },
  foco: {
    type: "choice",
    instructions: "O que melhorar?",
    criteria: { legenda: "texto", nada: "ok" },
  },
};

function withKey(value: string | undefined, run: () => Promise<void>) {
  const previous = process.env.JEV_API_KEY;
  if (value === undefined) delete process.env.JEV_API_KEY;
  else process.env.JEV_API_KEY = value;
  return run().finally(() => {
    if (previous === undefined) delete process.env.JEV_API_KEY;
    else process.env.JEV_API_KEY = previous;
  });
}

test("sem JEV_API_KEY não chama a rede e não devolve nota", async () => {
  await withKey(undefined, async () => {
    let called = false;
    const result = await askJev("anúncio", questions, {
      fetchImpl: async () => {
        called = true;
        throw new Error("não deveria chamar");
      },
    });
    assert.equal(result, null);
    assert.equal(called, false);
  });
});

test("chave vazia também não chama a rede", async () => {
  let called = false;
  const result = await askJev("anúncio", questions, {
    apiKey: "   ",
    fetchImpl: async () => {
      called = true;
      throw new Error("não deveria chamar");
    },
  });
  assert.equal(result, null);
  assert.equal(called, false);
});

test("falha da API devolve null e não propaga o erro", async () => {
  const rejected = await askJev("anúncio", questions, {
    apiKey: "segredo-teste",
    fetchImpl: async () => {
      throw new Error("rede caiu");
    },
  });
  assert.equal(rejected, null);

  const http = await askJev("anúncio", questions, {
    apiKey: "segredo-teste",
    fetchImpl: async () => new Response("falhou", { status: 503 }),
  });
  assert.equal(http, null);

  const broken = await askJev("anúncio", questions, {
    apiKey: "segredo-teste",
    fetchImpl: async () =>
      new Response("não é json", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
  });
  assert.equal(broken, null);
});

test("resposta válida devolve as decisões e não manda a chave no corpo", async () => {
  let seenUrl = "";
  let seenAuth = "";
  let seenBody = "";
  const result = await askJev("Honda Civic, legenda curta", questions, {
    apiKey: "segredo-teste",
    fetchImpl: async (url, init) => {
      seenUrl = String(url);
      seenAuth = new Headers(init?.headers).get("Authorization") ?? "";
      seenBody = String(init?.body ?? "");
      return Response.json({
        answers: {
          legenda: { score: 1.9, confidence: 0.77 },
          foco: { choice: "legenda" },
        },
        usage: { input_tokens: 10, output_tokens: 2 },
      });
    },
  });

  assert.equal(seenUrl, JEV_ENDPOINT);
  assert.equal(seenAuth, "Bearer segredo-teste");
  assert.equal(seenBody.includes("segredo-teste"), false);
  const body = JSON.parse(seenBody) as { model: string; questions: object };
  assert.equal(body.model, JEV_MODEL);
  assert.equal("legenda" in body.questions, true);
  assert.equal("foco" in body.questions, true);
  assert.equal(result?.legenda && typeof result.legenda, "object");
  assert.deepEqual(
    (result?.legenda as { score: number }).score,
    1.9,
  );
});
