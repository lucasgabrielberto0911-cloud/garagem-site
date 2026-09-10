import assert from "node:assert/strict";
import { test } from "node:test";
import {
  encodeSse,
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
