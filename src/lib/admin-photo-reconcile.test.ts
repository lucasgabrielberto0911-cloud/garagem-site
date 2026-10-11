import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcileAdminPhotos } from "./admin-photo-reconcile";
const current = [
  { id: "a", url: "foto-a", thumbnailUrl: "capa-a", order: 0 },
  { id: "b", url: "foto-b", thumbnailUrl: null, order: 1 },
];
test("salvar sem mudança preserva IDs sem gravar fotos novamente", () => {
  assert.deepEqual(reconcileAdminPhotos(current, current), { update: [], create: [], deleteIds: [] });
});
test("reordenar preserva os IDs e altera somente a ordem", () => {
  const plan = reconcileAdminPhotos(current, [current[1], current[0]]);
  assert.deepEqual(plan.update.map(photo => [photo.id, photo.order]), [["b", 0], ["a", 1]]);
  assert.deepEqual(plan.deleteIds, []);
});
test("giro, borrão e enquadramento mantêm o ID mesmo com URL nova", () => {
  const plan = reconcileAdminPhotos(current, [{ ...current[0], url: "girada", thumbnailUrl: "reenquadrada" }, current[1]]);
  assert.deepEqual(plan.update, [{ id: "a", url: "girada", thumbnailUrl: "reenquadrada", order: 0 }]);
  assert.deepEqual(plan.deleteIds, []);
});
test("foto nova cria registro e remoção apaga apenas o ID ausente", () => {
  assert.deepEqual(reconcileAdminPhotos(current, [current[0], "nova"]), {
    update: [], create: [{ url: "nova", thumbnailUrl: null, order: 1 }], deleteIds: ["b"],
  });
});
test("rascunhos sem ID casam por URL sem reutilizar registros duplicados", () => {
  const duplicates = current.map(photo => ({ ...photo, url: "igual", thumbnailUrl: null }));
  const plan = reconcileAdminPhotos(duplicates, ["igual", { url: "igual" }, "igual"]);
  assert.equal(plan.create.length, 1);
  assert.deepEqual(plan.deleteIds, []);
  assert.deepEqual(plan.update, []);
});
test("ID de outro veículo é novo mesmo quando a URL coincide", () => {
  const plan = reconcileAdminPhotos(current, [{ id: "externo", url: "foto-a" }, current[1]]);
  assert.deepEqual(plan.deleteIds, ["a"]);
  assert.equal(plan.create.length, 1);
});
test("ID explícito tem prioridade sobre fallback legado e não é reutilizado", () => {
  const plan = reconcileAdminPhotos(current, ["foto-a", current[0], current[0], current[1]]);
  assert.equal(plan.create.length, 2);
  assert.deepEqual(plan.deleteIds, []);
  assert.deepEqual(plan.update.map(photo => photo.id), ["a", "b"]);
});
