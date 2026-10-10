import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { JEV_ENDPOINT, JEV_MODEL, askJev, jevChoice, jevConfigured, jevScore } from "./jev";

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
  const result = await askJev({
    state: "x",
    questions: QUESTIONS,
    fetcher: async () => {
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
  const answers = await askJev({
    state: { oi: 1 },
    questions: QUESTIONS,
    apiKey: KEY,
    fetcher: async (url, init) => {
      seen.push({ url: String(url), init: init ?? {} });
      return json({ answers: { temperatura: { type: "score", score: 1, confidence: 1 } } });
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
  const result = await askJev({
    state: "x",
    questions: QUESTIONS,
    apiKey: KEY,
    fetcher: async () => json({ detail: `Bearer ${KEY} inválida` }, 401),
  });
  assert.equal(result, null);
  assert.ok(warnings.length > 0);
  assert.ok(warnings.every((line) => !line.includes(KEY)));
});

test("falha de rede devolve null sem vazar a mensagem do erro", async () => {
  const result = await askJev({
    state: "x",
    questions: QUESTIONS,
    apiKey: KEY,
    fetcher: async () => {
      throw new Error(`falhou com ${KEY}`);
    },
  });
  assert.equal(result, null);
  assert.ok(warnings.every((line) => !line.includes(KEY)));
});

test("timeout aborta o pedido e devolve null", async () => {
  const started = Date.now();
  const result = await askJev({
    state: "x",
    questions: QUESTIONS,
    apiKey: KEY,
    timeoutMs: 30,
    fetcher: (_url, init) =>
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
    const result = await askJev({
      state: "x",
      questions: QUESTIONS,
      apiKey: KEY,
      fetcher: async () => make(),
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
  assert.equal(jevScore({ t: { type: "choice", choice: "a", confidence: 1 } }, "t", 3), null);
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
