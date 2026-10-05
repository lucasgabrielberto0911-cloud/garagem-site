import assert from "node:assert/strict";
import { test } from "node:test";
import { draftVersionMatches } from "./admin-draft-version";

test("rascunhos só criam sem versão existente e só atualizam a versão lida", () => {
  const first = new Date("2026-10-05T12:00:00Z");
  const second = new Date("2026-10-05T12:00:01Z");
  assert.equal(draftVersionMatches(null, null), true);
  assert.equal(draftVersionMatches(null, first), false);
  assert.equal(draftVersionMatches(first.toISOString(), first), true);
  assert.equal(draftVersionMatches(first.toISOString(), second), false);
  assert.equal(draftVersionMatches(first.toISOString(), null), false);
});
