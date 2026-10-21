import assert from "node:assert/strict";
import test from "node:test";
import { claimPreparation, PREPARATION_CLAIM_ERROR, preparationPhotoError, preparationPrefill, vehicleDraftScope } from "./preparation";

const item = { brand: "Fiat", model: "Argo", color: "Branco", year: null, km: null, plate: "ABC1D23", purchasePrice: 40000 };

test("pré-preenchimento usa só dados reais: ano e km ausentes ficam em branco (não inventa 0/ano corrente)", () => {
  const p = preparationPrefill(item);
  assert.equal(p.year, undefined);
  assert.equal(p.km, undefined);
  assert.equal("fuel" in p, false);
  assert.equal("transmission" in p, false);
  assert.equal(p.purchasePrice, 40000);
  assert.equal(preparationPrefill({ ...item, year: 2020, km: 55000 }).km, 55000);
});

test("cadastro vindo de Em preparação exige foto antes de ir ao estoque", () => {
  assert.ok(preparationPhotoError(0));
  assert.equal(preparationPhotoError(3), null);
});

// Simula o banco: a preparação só existe uma vez e só vale se estiver pronta.
const fakeTx = (rows: { id: string; ready: boolean }[]) => ({
  preparationVehicle: {
    async deleteMany({ where }: { where: { id: string; ready: true } }) {
      const i = rows.findIndex((r) => r.id === where.id && r.ready === where.ready);
      if (i >= 0) rows.splice(i, 1);
      return { count: i >= 0 ? 1 : 0 };
    },
  },
});

test("duas conclusões da mesma preparação: a segunda falha", async () => {
  const tx = fakeTx([{ id: "p1", ready: true }]);
  await claimPreparation(tx, "p1");
  await assert.rejects(claimPreparation(tx, "p1"), { message: PREPARATION_CLAIM_ERROR });
});

test("preparação excluída ou desmarcada após abrir o formulário falha", async () => {
  await assert.rejects(claimPreparation(fakeTx([]), "p1"), { message: PREPARATION_CLAIM_ERROR });
  await assert.rejects(claimPreparation(fakeTx([{ id: "p1", ready: false }]), "p1"), { message: PREPARATION_CLAIM_ERROR });
});

test("rascunho do cadastro é isolado por preparação e do cadastro comum", () => {
  const a = vehicleDraftScope(undefined, "A");
  const b = vehicleDraftScope(undefined, "B");
  assert.notEqual(a, b);
  assert.notEqual(a, vehicleDraftScope());
  assert.equal(vehicleDraftScope(), "new");
  assert.equal(vehicleDraftScope("v1", "A"), "v1");
});
