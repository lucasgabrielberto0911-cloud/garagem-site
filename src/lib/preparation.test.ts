import assert from "node:assert/strict";
import test from "node:test";
import {
  claimPreparation,
  parsePreparationForm,
  PREPARATION_CLAIM_ERROR,
  preparationPhotoError,
  preparationPrefill,
  vehicleDraftScope,
} from "./preparation";

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

test("cadastros independentes coexistem e retomam o mesmo identificador", () => {
  assert.equal(vehicleDraftScope(null, null, "a"), "new-a");
  assert.equal(vehicleDraftScope(null, null, "new-a"), "new-a");
  assert.equal(vehicleDraftScope(null, null, "new"), "new");
  assert.equal(vehicleDraftScope(null, "new-p1"), "new-p1");
  assert.equal(vehicleDraftScope(null, null, vehicleDraftScope(null, null, "a")), "new-a");
  assert.equal(vehicleDraftScope(null, null, vehicleDraftScope()), "new");
  assert.notEqual(vehicleDraftScope(null, null, "a"), vehicleDraftScope(null, null, "b"));
  assert.equal(vehicleDraftScope("v1", "p1", "a"), "v1");
  assert.equal(vehicleDraftScope(null, "p1", "a"), "new-p1");
});

test("parsePreparationForm valida campos individuais com mensagens específicas", () => {
  // Marca e modelo obrigatórios
  const emptyForm = new FormData();
  const emptyRes = parsePreparationForm(emptyForm);
  assert.equal(emptyRes.ok, false);
  if (!emptyRes.ok) {
    assert.equal(emptyRes.errors.brand, "Informe a marca.");
    assert.equal(emptyRes.errors.model, "Informe o modelo.");
  }

  // Ano inválido
  const yearForm = new FormData();
  yearForm.set("brand", "Chevrolet");
  yearForm.set("model", "Onix");
  yearForm.set("year", "1800");
  const yearRes = parsePreparationForm(yearForm);
  assert.equal(yearRes.ok, false);
  if (!yearRes.ok) {
    assert.equal(yearRes.errors.year, "Ano inválido.");
  }

  // KM inválido
  const kmForm = new FormData();
  kmForm.set("brand", "Chevrolet");
  kmForm.set("model", "Onix");
  kmForm.set("km", "-50");
  const kmRes = parsePreparationForm(kmForm);
  assert.equal(kmRes.ok, false);
  if (!kmRes.ok) {
    assert.equal(kmRes.errors.km, "KM inválido.");
  }

  // Placa inválida
  const plateForm = new FormData();
  plateForm.set("brand", "Chevrolet");
  plateForm.set("model", "Onix");
  plateForm.set("plate", "INVALID");
  const plateRes = parsePreparationForm(plateForm);
  assert.equal(plateRes.ok, false);
  if (!plateRes.ok) {
    assert.equal(plateRes.errors.plate, "Placa inválida.");
  }

  // Valor de compra inválido
  const priceForm = new FormData();
  priceForm.set("brand", "Chevrolet");
  priceForm.set("model", "Onix");
  priceForm.set("purchasePrice", "abc");
  const priceRes = parsePreparationForm(priceForm);
  assert.equal(priceRes.ok, false);
  if (!priceRes.ok) {
    assert.equal(priceRes.errors.purchasePrice, "Valor de compra inválido.");
  }

  // Formulário válido com normalização
  const validForm = new FormData();
  validForm.set("brand", "Chevrolet");
  validForm.set("model", "Onix 1.0 Turbo");
  validForm.set("color", "Preto");
  validForm.set("year", "2023");
  validForm.set("km", "25.000");
  validForm.set("plate", "abc1d23");
  validForm.set("purchasePrice", "75.000,00");
  validForm.set("ready", "on");
  validForm.set("posted", "on");

  const validRes = parsePreparationForm(validForm);
  assert.equal(validRes.ok, true);
  if (validRes.ok) {
    assert.equal(validRes.data.brand, "Chevrolet");
    assert.equal(validRes.data.model, "Onix 1.0 Turbo");
    assert.equal(validRes.data.color, "Preto");
    assert.equal(validRes.data.year, 2023);
    assert.equal(validRes.data.km, 25000);
    assert.equal(validRes.data.plate, "ABC1D23");
    assert.equal(validRes.data.purchasePrice, 75000);
    assert.equal(validRes.data.ready, true);
    assert.equal(validRes.data.posted, true);
  }
});
