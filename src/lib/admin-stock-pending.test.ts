import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStockPending, stockPendingWhere } from "./admin-stock-pending";

test("pendências aceitam apenas filtros conhecidos e preservam a regra dos 60 dias", () => {
  assert.equal(parseStockPending("todos"), "");
  assert.equal(parseStockPending("sem-fotos"), "sem-fotos");
  assert.deepEqual(stockPendingWhere("sem-fotos"), { photos: { none: {} } });
  assert.deepEqual(stockPendingWhere(""), {});
  const before = Date.now() - 60 * 86400000;
  const result = stockPendingWhere("antigos");
  assert.equal(result.status, "disponivel");
  const cutoff = (result.createdAt as { lt: Date }).lt.getTime();
  assert.ok(cutoff >= before && cutoff <= Date.now() - 60 * 86400000);
});
