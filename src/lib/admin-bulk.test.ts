import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_BULK_MAX,
  bulkActionsForTab,
  bulkConfirmDescription,
  bulkFeaturedLeavingHome,
  bulkNamePreview,
  bulkStatusLabel,
  bulkUndoLabel,
  bulkUndoStatus,
  canUndoBulkStatus,
  idsNeedingBulkStatus,
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

test("lote na aba vendidos só devolve ao estoque e ignora quem já está no status", () => {
  assert.deepEqual(bulkActionsForTab("vendidos"), ["disponivel"]);
  assert.deepEqual(bulkActionsForTab("estoque"), ["disponivel", "vendido"]);
  const rows = [
    { id: "a", status: "disponivel", brand: "Honda", model: "Civic", featured: true },
    { id: "b", status: "reservado", brand: "Fiat", model: "Pulse", featured: false },
    { id: "c", status: "vendido", brand: "VW", model: "Fox", featured: false },
  ];
  assert.deepEqual(idsNeedingBulkStatus(rows, ["a", "b", "c"], "vendido"), [
    "a",
    "b",
  ]);
  assert.deepEqual(idsNeedingBulkStatus(rows, ["a", "c"], "disponivel"), ["c"]);
  assert.match(bulkNamePreview(rows, ["a", "b"]), /Honda Civic, Fiat Pulse/);
  assert.equal(bulkFeaturedLeavingHome(rows, ["a", "b"], "vendido"), 1);
  assert.equal(bulkFeaturedLeavingHome(rows, ["a"], "disponivel"), 0);
  assert.match(
    bulkConfirmDescription({
      status: "vendido",
      count: 2,
      names: "Honda Civic, Fiat Pulse",
      featuredLeaving: 1,
    }),
    /1 sai da home/,
  );
});
