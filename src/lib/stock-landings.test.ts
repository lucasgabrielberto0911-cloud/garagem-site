import assert from "node:assert/strict";
import { test } from "node:test";
import { stockLandingLinks, stockLandingSlug, stockLandingCopy } from "./stock-landings";
test("landings deduplicam caixa e acentos sem misturar marcas", () => {
  const links = stockLandingLinks([{ brand: "Honda", model: "Civic" }, { brand: "HONDA", model: "CIVIC" }, { brand: "Toyota", model: "Civic" }, { brand: "", model: "" }]);
  assert.equal(links.length, 4);
  assert.ok(links.some(row => row.path === "/modelo/honda-civic"));
  assert.ok(links.some(row => row.path === "/modelo/toyota-civic"));
  assert.equal(stockLandingSlug("Citroën C4 Cactus"), "citroen-c4-cactus");
  assert.deepEqual(stockLandingLinks([]), []);

  const dated = stockLandingLinks([
    { brand: "Honda", model: "Civic", updatedAt: "2026-10-10T10:00:00.000Z" },
    { brand: "Honda", model: "Fit", updatedAt: "2026-10-20T15:30:00.000Z" },
  ]);
  const honda = dated.find(row => row.path === "/marca/honda");
  const civic = dated.find(row => row.path === "/modelo/honda-civic");
  assert.equal(honda?.lastModified?.toISOString(), "2026-10-20T15:30:00.000Z");
  assert.equal(civic?.lastModified?.toISOString(), "2026-10-10T10:00:00.000Z");
});

test("texto da marca usa modelos reais; texto do modelo usa anos e contagem", () => {
  const rows = [
    { model: "Civic", yearModel: 2020, status: "disponivel" },
    { model: "Fit", yearModel: 2018, status: "disponivel" },
    { model: "City", yearModel: 2015, status: "vendido" },
  ];
  const brand = stockLandingCopy("marca", "Honda", rows);
  assert.match(brand.introduction, /2 veículos disponíveis de Honda/);
  assert.match(brand.introduction, /Civic, Fit/);
  assert.doesNotMatch(brand.introduction, /City/);
  const model = stockLandingCopy("modelo", "Honda Civic", rows.slice(0, 1));
  assert.match(model.introduction, /1 veículo disponível de Honda Civic/);
  assert.match(model.introduction, /Anos no estoque: 2020/);
});

test("histórico vendido não promete disponibilidade nem inclui preço", () => {
  const copy = stockLandingCopy("modelo", "Honda Civic", [{ model: "Civic", yearModel: 2015, status: "vendido" }]);
  assert.match(copy.description, /Sem Honda Civic disponível/);
  assert.match(copy.introduction, /já vendidos, sem preço/);
  assert.doesNotMatch(copy.introduction, /R\$/);
});
