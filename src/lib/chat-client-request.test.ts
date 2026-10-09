import assert from "node:assert/strict";
import { test } from "node:test";
import { requestChatReply } from "./chat-client-request";
import { encodeSse } from "./chat-stream";
const response = (body: string, status = 200, type = "text/event-stream") =>
  (async () =>
    new Response(body, {
      status,
      headers: { "Content-Type": type },
    })) as typeof fetch;
const signal = () => new AbortController().signal;

test("stream quebrado nunca apresenta resposta parcial como concluída", async () => {
  const deltas: string[] = [];
  await assert.rejects(
    requestChatReply(
      { mensagem: "Civic" },
      signal(),
      (t) => deltas.push(t),
      response(encodeSse("token", { text: "Pronto, regis" })),
    ),
  );
  assert.deepEqual(deltas, ["Pronto, regis"]);
});

test("resposta final substitui o rascunho e traz os cards e o registro real", async () => {
  const reply = "Contato registrado.";
  const payload = await requestChatReply(
    {},
    signal(),
    () => {},
    response(
      encodeSse("token", { text: "Cont" }) +
        encodeSse("done", {
          reply,
          leadCreated: true,
          vehicles: [],
          stockHref: null,
        }),
    ),
  );
  assert.equal(payload.reply, reply);
  assert.equal(payload.leadCreated, true);
});

test("limite, indisponibilidade e erro SSE são falhas explícitas, sem tentar reenviar", async () => {
  for (const status of [429, 503]) {
    let calls = 0;
    const fetcher = (async () => {
      calls++;
      return new Response(JSON.stringify({ reply: "Consulta indisponível" }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    await assert.rejects(
      requestChatReply({}, signal(), () => {}, fetcher),
      /Consulta indisponível/,
    );
    assert.equal(calls, 1);
  }
  await assert.rejects(
    requestChatReply(
      {},
      signal(),
      () => {},
      response(
        encodeSse("error", {
          reply: "Não concluído",
          vehicles: [],
          stockHref: null,
          leadCreated: false,
        }),
      ),
    ),
    /Não concluído/,
  );
});

test("cancelamento é enviado ao transporte, sem chamada extra", async () => {
  const controller = new AbortController();
  let calls = 0;
  const fetcher = (async (_url, opts) => {
    calls++;
    assert.equal(opts?.signal, controller.signal);
    return new Promise((_resolve, reject) =>
      opts?.signal?.addEventListener(
        "abort",
        () => reject(controller.signal.reason),
        { once: true },
      ),
    );
  }) as typeof fetch;
  const pending = requestChatReply({}, controller.signal, () => {}, fetcher);
  controller.abort(new Error("cancelado"));
  await assert.rejects(pending, /cancelado/);
  assert.equal(calls, 1);
});

test("done conclui a resposta mesmo se a conexão não fechar, e libera o leitor", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          encodeSse("done", {
            reply: "Resposta completa",
            leadCreated: false,
            vehicles: [],
            stockHref: null,
          }),
        ),
      );
    },
    cancel() {
      cancelled = true;
    },
  });
  const fetcher = (async () =>
    new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    })) as typeof fetch;
  const result = await requestChatReply({}, signal(), () => {}, fetcher);
  assert.equal(result.reply, "Resposta completa");
  assert.equal(cancelled, true);
});
