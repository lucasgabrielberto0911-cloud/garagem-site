import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_BULK_MAX,
  bulkStatusLabel,
  bulkUndoLabel,
  bulkUndoStatus,
  canUndoBulkStatus,
  isAdminBulkStatus,
  normalizeBulkVehicleIds,
} from "./admin-bulk";

test("lote só aceita disponível ou vendido e corta no teto", () => {
  assert.equal(isAdminBulkStatus("disponivel"), true);
  assert.equal(isAdminBulkStatus("vendido"), true);
  assert.equal(isAdminBulkStatus("reservado"), false);
  assert.equal(isAdminBulkStatus("apagado"), false);
  assert.deepEqual(
    normalizeBulkVehicleIds([" a ", "a", "", "b", "c"], 2),
    ["a", "b"],
  );
  const many = Array.from({ length: 40 }, (_, index) => `id-${index}`);
  assert.equal(normalizeBulkVehicleIds(many).length, ADMIN_BULK_MAX);
  assert.match(bulkStatusLabel("vendido", 3), /3 veículos como vendidos/);
  assert.match(bulkStatusLabel("disponivel", 1), /1 veículo como disponível/);
  assert.equal(canUndoBulkStatus("vendido"), true);
  assert.equal(canUndoBulkStatus("disponivel"), false);
  assert.equal(bulkUndoStatus("vendido"), "disponivel");
  assert.equal(bulkUndoStatus("disponivel"), null);
  assert.match(bulkUndoLabel("vendido", 2) ?? "", /voltar 2 para disponível/);
  assert.equal(bulkUndoLabel("disponivel", 2), null);
});
