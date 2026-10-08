import assert from "node:assert/strict";
import { test } from "node:test";
import { generateChatReply, generateChatReplyStream } from "./chat-gemini";

test("cancelar uma chamada ao provedor não tenta outros modelos nem gera nova cobrança", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "local-fixture-key";
  try {
    for (const streaming of [false, true]) {
      const controller = new AbortController();
      let calls = 0;
      globalThis.fetch = (async (_url, options) => {
        calls++;
        return new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(controller.signal.reason),
            { once: true },
          );
          controller.abort(new Error("local-cancel"));
        });
      }) as typeof fetch;
      const input = {
        systemPrompt: "teste",
        history: [],
        mensagem: "Civic",
        signal: controller.signal,
      };
      await assert.rejects(
        streaming ? generateChatReplyStream(input) : generateChatReply(input),
        /local-cancel/,
      );
      assert.equal(calls, 1);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});
