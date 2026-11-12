import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/components/admin/compra/PurchaseForm.tsx", "utf8");

test("avaliador: marca, modelo e ano vêm primeiro e a FIPE é buscada sem placa", () => {
  const brand = source.indexOf("['brand', 'Marca']"), year = source.indexOf('label="Ano-modelo"'), search = source.indexOf("Buscar versões FIPE</button>"), panel = source.indexOf("<FipeHistoryPanel"), plate = source.indexOf('<Field label="Placa">');
  for (const position of [brand, year, search, panel, plate]) assert.ok(position > 0);
  assert.ok(brand < year && year < search && search < panel && panel < plate, "ordem: marca/modelo/ano → buscar versões → versão FIPE → placa");
});

test("avaliador: placa é opcional e o preenchimento manual não fica mais escondido", () => {
  assert.match(source, /Tem a placa\? \(opcional\)/);
  assert.doesNotMatch(source, /Preencher sem consulta|setManual/);
  assert.match(source, /disabled=\{!input\.identity\.brand\.trim\(\) \|\| !input\.identity\.model\.trim\(\) \|\| !input\.identity\.modelYear\}/);
});

test("avaliador: digitar a placa não apaga marca, modelo, ano nem km já preenchidos", () => {
  const onChange = source.slice(source.indexOf('<Field label="Placa">'), source.indexOf("onBlur={() => void consult()}"));
  assert.match(onChange, /change\(\{ \.\.\.input, plate: e\.target\.value, source: null \}\)/);
  assert.doesNotMatch(onChange, /newQuickPurchase\(\)\.identity|km: null/);
});
