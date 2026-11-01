import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStockFacets } from "./stock-facets";
import { buildStockWhere } from "./vehicles";

const row = {
  category: "carro", brand: "Honda", model: "Civic", transmission: "Automático",
  fuel: "Flex", color: "preto", yearModel: 2020, accessories: ["ABS"],
};

test("facetas deduplicam marcas, modelos, anos e acessórios sem perder opções", () => {
  const result = buildStockFacets([
    row,
    { ...row, brand: "HONDA", model: "CIVIC", yearModel: 2018, accessories: ["abs", " Airbag "] },
    { ...row, brand: "Toyota", model: "Corolla", color: null, yearModel: 2020 },
  ]);
  assert.deepEqual(result.brands, ["Honda", "Toyota"]);
  assert.deepEqual(result.models, [{ brand: "Honda", model: "Civic", categories: ["carro"] }, { brand: "Toyota", model: "Corolla", categories: ["carro"] }]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.models)), result.models);
  assert.deepEqual(result.years, [2020, 2018]);
  assert.deepEqual(result.accessories, ["ABS", "Airbag"]);
  assert.deepEqual(result.categories, ["carro"]);
  assert.deepEqual(result.colors, ["Preto"]);
});

test("facetas incluem acessórios além do antigo limite de 400 e aceitam estoque vazio", () => {
  const rows = Array.from({ length: 401 }, (_, i) => ({ ...row, accessories: i === 400 ? ["Teto solar"] : [] }));
  assert.deepEqual(buildStockFacets(rows).accessories, ["Teto solar"]);
  assert.ok(Object.values(buildStockFacets([])).every(values => values.length === 0));
});


test("facilidades comerciais ficam fora do filtro de opcionais", () => {
  assert.deepEqual(buildStockFacets([{ ...row, accessories: ["Conforto: Direção elétrica", "Facilidades: Aceitamos troca"] }]).accessories, ["Conforto: Direção elétrica"]);
});

test("facetas normalizam opcionais com truncamento e grafias equivalentes", () => {
  const result = buildStockFacets([
    { ...row, accessories: ["6 Air Bags", "Alarme perimétrico", "GPS integ", "iTPMS"] },
  ]);
  assert.deepEqual(result.accessories, [
    "6 airbags",
    "Alarme",
    "GPS integrado",
    "Sensor de pressão dos pneus (TPMS)",
  ]);
});

test("filtro de opcionais casa com valores crus gravados no estoque", () => {
  const where = buildStockWhere({ accessories: ["6 airbags"] }) as { AND: { accessories: { hasSome: string[] } }[] };
  const condition = where.AND.find((item) => "accessories" in item);
  assert.ok(condition);
  assert.ok(condition.accessories.hasSome.includes("6 Air Bags"));
  assert.ok(condition.accessories.hasSome.includes("6 airbags"));

  const whereFrontais = buildStockWhere({ accessories: ["Airbags frontais"] }) as { AND: { accessories: { hasSome: string[] } }[] };
  const conditionFrontais = whereFrontais.AND.find((item) => "accessories" in item);
  assert.ok(conditionFrontais);
  assert.ok(conditionFrontais.accessories.hasSome.includes("Airbag duplo"));
  assert.ok(conditionFrontais.accessories.hasSome.includes("Airbags frontais"));
});
