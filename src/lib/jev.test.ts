import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  JEV_ENDPOINT,
  JEV_MODEL,
  askJev,
  jevChoice,
  jevConfigured,
  jevScore,
  type JevQuestion,
} from "./jev";

const KEY = "chave-secreta-de-teste-123";
const QUESTIONS = {
  temperatura: { type: "score", instructions: "?", criteria: ["a", "b", "c"] },
} as const;

let warnings: string[] = [];
const realWarn = console.warn;
const realKey = process.env.JEV_API_KEY;

beforeEach(() => {
  warnings = [];
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  };
});

afterEach(() => {
  console.warn = realWarn;
  if (realKey === undefined) delete process.env.JEV_API_KEY;
  else process.env.JEV_API_KEY = realKey;
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

test("sem JEV_API_KEY não chama a API e devolve null", async () => {
  delete process.env.JEV_API_KEY;
  let calls = 0;
  const result = await askJev("x", QUESTIONS, {
    fetchImpl: async () => {
      calls += 1;
      return json({});
    },
  });
  assert.equal(result, null);
  assert.equal(calls, 0);
  assert.equal(jevConfigured({}), false);
  assert.equal(jevConfigured({ JEV_API_KEY: "  " }), false);
  assert.equal(jevConfigured({ JEV_API_KEY: KEY }), true);
});

test("manda modelo, estado e todas as perguntas num único pedido", async () => {
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const answers = await askJev({ oi: 1 }, QUESTIONS, {
    apiKey: KEY,
    fetchImpl: async (url, init) => {
      seen.push({ url: String(url), init: init ?? {} });
      return json({
        answers: { temperatura: { type: "score", score: 1, confidence: 1 } },
      });
    },
  });
  assert.ok(answers?.temperatura);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, JEV_ENDPOINT);
  const headers = seen[0].init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${KEY}`);
  const body = JSON.parse(String(seen[0].init.body));
  assert.equal(body.model, JEV_MODEL);
  assert.deepEqual(body.state, { oi: 1 });
  assert.deepEqual(Object.keys(body.questions), ["temperatura"]);
});

test("erro HTTP devolve null e o log não traz a chave", async () => {
  const result = await askJev("x", QUESTIONS, {
    apiKey: KEY,
    fetchImpl: async () => json({ detail: `Bearer ${KEY} inválida` }, 401),
  });
  assert.equal(result, null);
  assert.ok(warnings.length > 0);
  assert.ok(warnings.every((line) => !line.includes(KEY)));
});

test("falha de rede devolve null sem vazar a mensagem do erro", async () => {
  const result = await askJev("x", QUESTIONS, {
    apiKey: KEY,
    fetchImpl: async () => {
      throw new Error(`falhou com ${KEY}`);
    },
  });
  assert.equal(result, null);
  assert.ok(warnings.every((line) => !line.includes(KEY)));
});

test("timeout aborta o pedido e devolve null", async () => {
  const started = Date.now();
  const result = await askJev("x", QUESTIONS, {
    apiKey: KEY,
    timeoutMs: 30,
    fetchImpl: (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        // O timer do AbortSignal.timeout não segura o event loop do teste.
        const hold = setTimeout(() => undefined, 5_000);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(hold);
          reject(init.signal?.reason);
        });
      }),
  });
  assert.equal(result, null);
  assert.ok(Date.now() - started < 1_000);
});

test("resposta malformada devolve null", async () => {
  const cases: Array<() => Response> = [
    () => new Response("<html>502</html>", { status: 200 }),
    () => json({}),
    () => json({ answers: null }),
    () => json({ answers: [] }),
    () => json({ answers: "ok" }),
    () => json(null),
  ];
  for (const make of cases) {
    const result = await askJev("x", QUESTIONS, {
      apiKey: KEY,
      fetchImpl: async () => make(),
    });
    assert.equal(result, null);
  }
});

test("jevScore normaliza o índice da escala para 0–1 e rejeita lixo", () => {
  const ok = (score: unknown, confidence: unknown = 0.9) => ({
    t: { type: "score", score, confidence },
  });
  assert.deepEqual(jevScore(ok(2), "t", 3), { value: 1, confidence: 0.9 });
  assert.deepEqual(jevScore(ok(1), "t", 3), { value: 0.5, confidence: 0.9 });
  assert.equal(jevScore(ok(3.5), "t", 3), null);
  assert.equal(jevScore(ok(-1), "t", 3), null);
  assert.equal(jevScore(ok("2"), "t", 3), null);
  assert.equal(jevScore(ok(Number.NaN), "t", 3), null);
  assert.equal(jevScore(ok(1, 7), "t", 3), null);
  assert.equal(jevScore(ok(1, null), "t", 3), null);
  assert.equal(
    jevScore({ t: { type: "choice", choice: "a", confidence: 1 } }, "t", 3),
    null,
  );
  assert.equal(jevScore({}, "t", 3), null);
  assert.equal(jevScore(ok(1), "t", 1), null);
});

test("jevChoice só aceita opções esperadas", () => {
  const answers = (choice: unknown, confidence: unknown = 0.8) => ({
    i: { type: "choice", choice, confidence },
  });
  assert.deepEqual(jevChoice(answers("a"), "i", ["a", "b"] as const), {
    choice: "a",
    confidence: 0.8,
  });
  assert.equal(jevChoice(answers("c"), "i", ["a", "b"] as const), null);
  assert.equal(jevChoice(answers(5), "i", ["a", "b"] as const), null);
  assert.equal(jevChoice(answers("a", "alta"), "i", ["a", "b"] as const), null);
  assert.equal(jevChoice({}, "i", ["a"] as const), null);
});

test("loga o sucesso só com status e latência, nunca chave, estado ou texto", async () => {
  const infos: unknown[][] = [];
  const realInfo = console.info;
  console.info = (...args: unknown[]) => {
    infos.push(args);
  };
  try {
    const answers = await askJev(
      { conversa: "texto sigiloso do visitante" },
      QUESTIONS,
      {
        apiKey: KEY,
        fetchImpl: async () =>
          json({
            answers: {
              temperatura: { type: "score", score: 1, confidence: 1 },
            },
          }),
      },
    );
    assert.ok(answers?.temperatura);
    assert.equal(infos.length, 1);
    assert.equal(infos[0]![0], "[jev] ok");
    const detail = infos[0]![1] as { status: number; ms: number };
    assert.equal(detail.status, 200);
    assert.equal(typeof detail.ms, "number");
    assert.ok(detail.ms >= 0);
    assert.deepEqual(Object.keys(detail).sort(), ["ms", "status"]);
    assert.doesNotMatch(JSON.stringify(infos), new RegExp(`${KEY}|sigiloso`));
    // Falha continua em warn, sem log de sucesso.
    infos.length = 0;
    const failed = await askJev("x", QUESTIONS, {
      apiKey: KEY,
      fetchImpl: async () => json({}, 500),
    });
    assert.equal(failed, null);
    assert.equal(infos.length, 0);
  } finally {
    console.info = realInfo;
  }
});

// Forma de chamada do admin (PR #238): estado em texto e opções nomeadas.

const adminQuestions: Record<string, JevQuestion> = {
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
    const result = await askJev("anúncio", adminQuestions, {
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
  const result = await askJev("anúncio", adminQuestions, {
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
  const rejected = await askJev("anúncio", adminQuestions, {
    apiKey: "segredo-teste",
    fetchImpl: async () => {
      throw new Error("rede caiu");
    },
  });
  assert.equal(rejected, null);

  const http = await askJev("anúncio", adminQuestions, {
    apiKey: "segredo-teste",
    fetchImpl: async () => new Response("falhou", { status: 503 }),
  });
  assert.equal(http, null);

  const broken = await askJev("anúncio", adminQuestions, {
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
  const result = await askJev("Honda Civic, legenda curta", adminQuestions, {
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
  assert.deepEqual((result?.legenda as { score: number }).score, 1.9);
});
