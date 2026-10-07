import test from "node:test";
import assert from "node:assert/strict";
import { stockSearchSuggestions, stockSearchWhere } from "./stock-search";
const catalog = [{ brand: "Honda", model: "HR-V" }, { brand: "Honda", model: "CG 160 Start" }, { brand: "Honda", model: "Civic" }, { brand: "Citroën", model: "C3" }];
function modelChoices(query: string) { return stockSearchWhere(query, catalog).flatMap(clause => clause.OR ?? []).flatMap(row => typeof row.model === "object" && row.model.in ? row.model.in : []); }
test("variações de separadores usam os nomes reais do catálogo", () => {
  for (const query of ["HRV", "HR-V", "hr v"]) assert.ok(modelChoices(query).includes("HR-V"));
  for (const query of ["CG160", "CG 160", "CG-160", "CG 160 Start"]) assert.ok(modelChoices(query).includes("CG 160 Start"));
  assert.equal(stockSearchWhere("HR V", catalog).length, 1);
  assert.equal(stockSearchWhere("CG 160 Start", catalog).length, 1);
});

const fullCatalog = [
  { brand: "Honda", model: "Civic", version: "LXR 2.0 FlexOne" },
  { brand: "Honda", model: "HR-V", version: "EXL 1.8 Flexone" },
  { brand: "Honda", model: "City", version: "EXL 1.5 CVT I-VTEC" },
  { brand: "Honda", model: "CG 160 Start", version: "Start" },
  { brand: "Renault", model: "Duster", version: "Dynamique 2.0 16V Tech Road 2" },
  { brand: "Citroën", model: "C3", version: "Exclusive" },
];
test("erros por letra ausente, a mais, trocada e transposta sugerem o nome real", () => {
  for (const q of ["civc", "civick", "civci", "civuc", "civicc", "civk", "sivik", "civique"]) assert.ok(stockSearchSuggestions(q, fullCatalog).includes("Civic"), q);
  assert.ok(stockSearchSuggestions("renaut dusteer", fullCatalog).includes("Renault Duster"));
  assert.ok(stockSearchSuggestions("honad civc 2015", fullCatalog).includes("Honda Civic 2015"));
  assert.ok(stockSearchSuggestions("honad civc2015", fullCatalog).includes("Honda Civic 2015"));
});
test("ano colado ao nome e fabricação/modelo são números exatos", () => {
  assert.deepEqual(stockSearchWhere("Civic2015", fullCatalog), stockSearchWhere("Civic 2015", fullCatalog));
  assert.deepEqual(stockSearchWhere("Civic/2015", fullCatalog), stockSearchWhere("Civic 2015", fullCatalog));
  assert.deepEqual(stockSearchWhere("2011/2012", fullCatalog), [{ AND: [{ year: 2011 }, { yearModel: 2012 }] }]);
  assert.equal(stockSearchWhere("CG160", fullCatalog).length, 1);
});
test("abreviação de marca só aponta para a marca cadastrada", () => {
  const rows = [{ brand: "Volkswagen", model: "Gol" }, { brand: "Chevrolet", model: "Onix" }];
  for (const [query, brand] of [["VW", "Volkswagen"], ["GM", "Chevrolet"], ["Chevy", "Chevrolet"]]) {
    assert.ok(stockSearchWhere(query, rows)[0].OR?.some(row => typeof row.brand === "object" && row.brand.in?.includes(brand)));
  }
  assert.deepEqual(modelChoices("VW"), []);
});
test("versão é preservada e também aceita erro de letra sem mudar cilindrada", () => {
  assert.ok(stockSearchSuggestions("civc LXR 2.0", fullCatalog).includes("Civic LXR 2.0"));
  assert.ok(stockSearchSuggestions("Duster dinamiqe 2.0", fullCatalog).includes("Duster Dynamique 2.0"));
  assert.deepEqual(stockSearchSuggestions("CG 106", fullCatalog), []);
  assert.deepEqual(stockSearchSuggestions("2016", fullCatalog), []);
});
test("não inventa carro nem aproxima termos curtos ou muito diferentes", () => {
  for (const q of ["XYZ", "BMW", "Fiesta", "Fit", "Gol", "x", "20"]) assert.deepEqual(stockSearchSuggestions(q, fullCatalog), [], q);
  assert.deepEqual(stockSearchSuggestions("civc", []), []);
  assert.deepEqual(stockSearchSuggestions("x".repeat(121), fullCatalog), []);
  assert.ok(stockSearchSuggestions("civc", fullCatalog).length <= 3);
});
test("espaços, hífens, acentos e versão compacta mantêm os campos reais", () => {
  assert.ok(stockSearchWhere("citroen", fullCatalog)[0].OR?.some(row => typeof row.brand === "object" && row.brand.in?.includes("Citroën")));
  assert.ok(stockSearchWhere("honda-civic", fullCatalog)[0].OR?.some(row => row.AND));
  assert.ok(stockSearchWhere("LXR2.0", fullCatalog)[0].OR?.some(row => typeof row.version === "object" && row.version.in?.includes("LXR 2.0 FlexOne")));
  assert.equal(stockSearchWhere("Civic 2015", fullCatalog).length, 2);
});
test("ano é um critério separado e não texto da versão", () => {
  const clauses = stockSearchWhere("Honda Civic 2015", catalog);
  assert.equal(clauses.length, 3);
  assert.deepEqual(clauses[2], { OR: [{ year: 2015 }, { yearModel: 2015 }] });
  assert.equal(stockSearchWhere("CG160 2024", catalog).length, 2);
});
test("não troca modelo inexistente por parecido nem descarta termos da versão", () => {
  assert.deepEqual(modelChoices("XYZ", catalog), []);
  assert.equal(stockSearchWhere("Civic LXR 2.0", catalog).length, 3);
  assert.deepEqual(stockSearchWhere(" ", catalog), []);
  assert.equal(stockSearchWhere("160", catalog)[0].OR?.length, 4);
});
