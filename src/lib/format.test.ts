import assert from "node:assert/strict";
import { test } from "node:test";
import { formatListedAgo } from "./format";

test("formatListedAgo aceita Date e ISO sem quebrar", () => {
  assert.equal(formatListedAgo(new Date()), "Anunciado hoje");
  assert.equal(formatListedAgo(new Date().toISOString()), "Anunciado hoje");
  assert.equal(formatListedAgo("não-é-data"), "");
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
  assert.equal(formatListedAgo(twoDaysAgo.toISOString()), "Anunciado há 2 dias");
});
