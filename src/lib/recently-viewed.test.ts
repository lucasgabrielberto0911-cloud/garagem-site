import test from "node:test";
import assert from "node:assert/strict";
import { parseRecentVisits, withRecentVisit } from "./recently-viewed";
const id = (n: number) => "c" + String(n).padStart(24, "0");
test("reabrir a ficha move o id para o início sem duplicar", () => {
  const visits = [{ id: id(1), viewedAt: 50 }, { id: id(2), viewedAt: 40 }];
  assert.deepEqual(withRecentVisit(visits, id(2), 100), [{ id: id(2), viewedAt: 100 }, visits[0]]);
  assert.equal(withRecentVisit(Array.from({ length: 8 }, (_, n) => ({ id: id(n), viewedAt: 1 })), id(9), 100).length, 8);
});
test("histórico corrompido, expirado ou inválido não chega à API", () => {
  const now = 31 * 24 * 60 * 60 * 1000;
  assert.deepEqual(parseRecentVisits("{oops", now), []);
  assert.deepEqual(parseRecentVisits('"string"', now), []);
  const rows = [{ id: id(1), viewedAt: now }, { id: id(1), viewedAt: now }, { id: id(2), viewedAt: 1 }, { id: "bad", viewedAt: now }, { id: id(3), viewedAt: now + 1 }];
  assert.deepEqual(parseRecentVisits(JSON.stringify(rows), now), [rows[0]]);
});
test("visitas armazenam apenas id e horário e id inválido não entra", () => {
  assert.deepEqual(withRecentVisit([], "bad"), []);
  assert.deepEqual(Object.keys(withRecentVisit([], id(1), 100)[0]), ["id", "viewedAt"]);
});
