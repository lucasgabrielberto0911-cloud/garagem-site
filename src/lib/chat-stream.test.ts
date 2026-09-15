import assert from "node:assert/strict";
import { test } from "node:test";
import {
  catchUpStreamText,
  drainJsonSseBuffer,
  drainSseBuffer,
  encodeSse,
  finalChatStreamReply,
  parseJsonSseFrames,
  parseSseChunks,
  readChatStreamFrame,
} from "./chat-stream";

test("SSE do chat empacota token e done", () => {
  const raw = `${encodeSse("token", { text: "Olá" })}${encodeSse("done", {
    reply: "Olá, tudo bem.",
    leadCreated: false,
    vehicles: [],
    stockHref: null,
  })}`;
  const parsed = parseSseChunks(raw);
  assert.equal(parsed.frames.length, 2);
  assert.deepEqual(readChatStreamFrame(parsed.frames[0]!.event, parsed.frames[0]!.data), {
    type: "token",
    text: "Olá",
  });
  assert.deepEqual(readChatStreamFrame(parsed.frames[1]!.event, parsed.frames[1]!.data), {
    type: "done",
    reply: "Olá, tudo bem.",
    leadCreated: false,
    vehicles: [],
    stockHref: null,
  });
});

test("SSE com CRLF não perde o segundo evento nem o done no flush", () => {
  const raw =
    `event: token\r\ndata: ${JSON.stringify({ text: "Ol" })}\r\n\r\n` +
    `event: token\r\ndata: ${JSON.stringify({ text: "ha só" })}\r\n\r\n` +
    `event: done\r\ndata: ${JSON.stringify({
      reply: "Olha só: o Fox faz 9–12 km/l.",
      leadCreated: false,
      vehicles: [],
      stockHref: null,
    })}`;
  const closed = `${raw}\r\n\r\n`;
  const parsed = parseSseChunks(closed);
  assert.equal(parsed.frames.length, 3);
  const fromRest = drainSseBuffer(raw);
  assert.equal(fromRest.length, 3);
  const done = parsed.frames.find((frame) => frame.event === "done");
  assert.equal(
    readChatStreamFrame(done!.event, done!.data)?.type,
    "done",
  );
  assert.equal(
    (readChatStreamFrame(done!.event, done!.data) as { reply: string }).reply,
    "Olha só: o Fox faz 9–12 km/l.",
  );
});

test("Gemini alt=sse CRLF concatena todos os deltas, não só o primeiro", () => {
  const chunk = (text: string) =>
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    });
  const raw = `data: ${chunk("Ol")}\r\n\r\ndata: ${chunk("ha só, o Fox faz 9–12 km/l.")}\r\n\r\n`;
  const frames = drainJsonSseBuffer(raw);
  assert.equal(frames.length, 2);
  const texts = frames.map((frame) => {
    const parts = (frame as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      .candidates?.[0]?.content?.parts ?? [];
    return parts.map((part) => part.text ?? "").join("");
  });
  assert.equal(texts.join(""), "Olha só, o Fox faz 9–12 km/l.");
  const incomplete = parseJsonSseFrames(`data: ${chunk("Ol")}\r\n\r\ndata: {"candidates"`);
  assert.equal(incomplete.frames.length, 1);
  assert.match(incomplete.rest, /candidates/);
});

test("catch-up do stream só completa o prefixo, sem duplicar resposta diferente", () => {
  assert.equal(
    catchUpStreamText("Ol", "Olha só: o Fox faz 9–12 km/l."),
    "ha só: o Fox faz 9–12 km/l.",
  );
  assert.equal(
    catchUpStreamText("Ol", "Para o Fox 1.6 flex, a faixa típica de catálogo fica 9–12 km/l."),
    "",
  );
  assert.equal(
    catchUpStreamText(
      "Olha só: automáticos até o limite de R$",
      "Olha só: automáticos até o limite de R$ 70.000 no estoque agora.",
    ),
    " 70.000 no estoque agora.",
  );
});

test("done.reply completo substitui o corte em limite de R$", () => {
  const full = "Olha só: automáticos até o limite de R$ 70.000 no estoque agora.";
  assert.equal(
    finalChatStreamReply("Olha só: automáticos até o limite de R$", full),
    full,
  );
  assert.equal(
    finalChatStreamReply("Olha só: automáticos até o limite de R$.", full),
    full,
  );
  assert.doesNotMatch(
    finalChatStreamReply("Olha só: automáticos até o limite de R$", full),
    /R\$$/,
  );
});
