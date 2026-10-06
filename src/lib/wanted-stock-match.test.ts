import assert from "node:assert/strict";
import { test } from "node:test";
import { matchWhatsApp, wantedStockMatch, type MatchLead, type MatchVehicle } from "./wanted-stock-match";
import { WANTED_LEAD_SOURCE } from "./leads";

const lead: MatchLead = { id: "lead", name: "Cliente Teste", phone: "27912345678", vehicleInfo: "Honda Civic", notes: null, status: "novo", source: WANTED_LEAD_SOURCE };
const car: MatchVehicle = { id: "cmt0ewzpg0000lc0493fl02h7", brand: "Honda", model: "Civic", version: "LXR 2.0", yearModel: 2015, price: 60000, km: 90000, transmission: "Automático", status: "disponivel", historical: false };
test("sugere somente o modelo e os critérios realmente informados", () => {
  assert.deepEqual(wantedStockMatch(lead, car), ["Modelo"]);
  assert.deepEqual(wantedStockMatch({ ...lead, notes: "Ano: 2014 a 2016\nPreço: até R$ 65.000\nKm: até 100.000\nCâmbio: Automático" }, car), ["Modelo", "Ano", "Preço", "Km", "Câmbio"]);
  for (const notes of ["Ano: a partir de 2016", "Preço: até R$ 50.000", "Km: até 80.000", "Câmbio: Manual", "Ano: inválido", "Preço: 70.000 a 50.000"]) assert.equal(wantedStockMatch({ ...lead, notes }, car), null);
});
test("não inventa correspondência para modelos ambíguos, marca ou outro anúncio", () => {
  for (const vehicleInfo of ["Honda", "Civ", "Civic ou Corolla", "Civic EXL", "SUV barato"]) assert.equal(wantedStockMatch({ ...lead, vehicleInfo }, car), null);
  assert.ok(wantedStockMatch({ ...lead, vehicleInfo: "Civic LXR 2.0 2015" }, car));
  const hrv = { ...car, model: "HR-V" };
  assert.ok(wantedStockMatch({ ...lead, vehicleInfo: "Honda HRV" }, hrv));
  const cg = { ...car, model: "CG 160 Start" };
  assert.ok(wantedStockMatch({ ...lead, vehicleInfo: "CG160" }, cg));
  assert.equal(wantedStockMatch({ ...lead, vehicleInfo: "CG 125" }, cg), null);
});
test("retira fechado, perdido, reservado, vendido e histórico", () => {
  for (const status of ["fechado", "perdido"]) assert.equal(wantedStockMatch({ ...lead, status }, car), null);
  for (const status of ["reservado", "vendido"]) assert.equal(wantedStockMatch(lead, { ...car, status }), null);
  assert.equal(wantedStockMatch(lead, { ...car, historical: true }), null);
  assert.equal(wantedStockMatch({ ...lead, source: "vender" }, car), null);
});
test("WhatsApp abre para o cliente, com fatos e ficha reais, sem enviar sozinho", () => {
  const href = matchWhatsApp(lead, car);
  assert.ok(href?.startsWith("https://wa.me/5527912345678"));
  assert.match(decodeURIComponent(href!), /R\$\s*60\.000/);
  assert.match(decodeURIComponent(href!), /https:\/\/www\.suagaragem\.net\/estoque\/honda-civic/);
  assert.equal(matchWhatsApp({ ...lead, phone: "" }, car), null);
  assert.doesNotMatch(decodeURIComponent(matchWhatsApp(lead, { ...car, price: 0 })!), /por R\$/);
  assert.equal(wantedStockMatch({ ...lead, notes: "Preço: até R$ 65.000" }, { ...car, price: 0 }), null);
});
