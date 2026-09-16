import assert from "node:assert/strict";
import { test } from "node:test";
import { CHAT_HELP_LABEL } from "./chat-open";

test("o botão do chat usa exatamente “Ajuda para escolher”, sem “pra”", () => {
  assert.equal(CHAT_HELP_LABEL, "Ajuda para escolher");
  assert.doesNotMatch(CHAT_HELP_LABEL, /(^|[^a-zà-ü])pra([^a-zà-ü]|$)/i);
  assert.match(CHAT_HELP_LABEL, /\bpara\b/);
});
