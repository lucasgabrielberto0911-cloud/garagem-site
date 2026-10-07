import test from "node:test";
import assert from "node:assert/strict";
import { stockSearchWhere } from "./stock-search";
const catalog = [{ brand: "Honda", model: "HR-V" }, { brand: "Honda", model: "CG 160 Start" }, { brand: "Honda", model: "Civic" }, { brand: "Citroën", model: "C3" }];
function modelChoices(query: string) { return stockSearchWhere(query, catalog).flatMap(clause => clause.OR ?? []).flatMap(row => typeof row.model === "object" && row.model.in ? row.model.in : []); }
test("variações de separadores usam os nomes reais do catálogo", () => {
  for (const query of ["HRV", "HR-V", "hr v"]) assert.ok(modelChoices(query).includes("HR-V"));
  for (const query of ["CG160", "CG 160", "CG-160", "CG 160 Start"]) assert.ok(modelChoices(query).includes("CG 160 Start"));
  assert.equal(stockSearchWhere("HR V", catalog).length, 1);
  assert.equal(stockSearchWhere("CG 160 Start", catalog).length, 1);
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
