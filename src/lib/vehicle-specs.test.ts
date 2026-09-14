import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SPEC_EMPTY,
  SPEC_EMPTY_FEMININE,
  buildVehiclePublicSpecs,
  formatVehicleYearRange,
} from "./vehicle-specs";

test("ficha sempre mostra os campos centrais, sem buraco de cor vazia", () => {
  const specs = buildVehiclePublicSpecs({
    category: "carro",
    year: 2014,
    yearModel: 2014,
    km: 98000,
    fuel: "Flex",
    transmission: "Manual",
    color: "",
  });
  const byLabel = Object.fromEntries(specs.map((row) => [row.label, row]));
  assert.equal(byLabel.Ano?.value, "2014");
  assert.equal(byLabel.KM?.value, "98.000");
  assert.equal(byLabel.Câmbio?.value, "Manual");
  assert.equal(byLabel.Combustível?.value, "Flex");
  assert.equal(byLabel.Cor?.value, SPEC_EMPTY_FEMININE);
  assert.equal(byLabel.Cor?.empty, true);
  assert.equal(specs.some((row) => row.label === "Motor"), false);
});

test("ano fabricado/modelo e opcionais só entram quando existem", () => {
  assert.equal(formatVehicleYearRange(2013, 2014), "2013/2014");
  const specs = buildVehiclePublicSpecs({
    category: "carro",
    year: 2013,
    yearModel: 2014,
    km: 0,
    fuel: "",
    transmission: "",
    color: "Prata",
    engine: "1.6",
    doors: 4,
    inspection: "Cautelar aprovado",
  });
  const byLabel = Object.fromEntries(specs.map((row) => [row.label, row]));
  assert.equal(byLabel.Ano?.value, "2013/2014");
  assert.equal(byLabel.Combustível?.value, SPEC_EMPTY);
  assert.equal(byLabel.Combustível?.empty, true);
  assert.equal(byLabel.Câmbio?.empty, true);
  assert.equal(byLabel.Motor?.value, "1.6");
  assert.equal(byLabel.Portas?.value, "4");
  assert.equal(byLabel.Laudo?.value, "Cautelar aprovado");
});
