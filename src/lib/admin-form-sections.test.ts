import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accessoriesSummary,
  descriptionSummary,
  fichaSummary,
  identitySummary,
  initialOpenSections,
  sectionForField,
  sectionsWithErrors,
  vehicleFormSections,
} from "./admin-form-sections";

test("ordem mobile-first: veículo, preço, fotos, ficha, descrição, itens", () => {
  assert.deepEqual(
    vehicleFormSections("edit").map((section) => section.id),
    ["identificacao", "essencial", "fotos", "ficha", "descricao", "itens"],
  );
  assert.equal(vehicleFormSections("create").at(-1)?.id, "operacao");
});

test("edição abre só preço/status e fotos; cadastro novo abre o que precisa preencher", () => {
  assert.deepEqual(initialOpenSections("edit"), ["essencial", "fotos"]);
  assert.deepEqual(
    initialOpenSections("edit", { descriptionNeedsAttention: true }),
    ["essencial", "fotos", "descricao"],
  );
  const create = initialOpenSections("create");
  assert.ok(create.includes("identificacao"));
  assert.ok(create.includes("ficha"));
  assert.ok(!create.includes("operacao"));
});

test("erro de validação aponta a seção certa, na ordem da tela", () => {
  assert.equal(sectionForField("km"), "ficha");
  assert.equal(sectionForField("locationCity"), "essencial");
  assert.equal(sectionForField("nao-existe"), null);
  assert.deepEqual(
    sectionsWithErrors({
      description: "Preço do texto diferente",
      km: "Informe a km",
      brand: "Informe a marca",
      price: "",
    }),
    ["identificacao", "ficha", "descricao"],
  );
});

test("resumos das seções fechadas cabem numa linha", () => {
  assert.equal(
    identitySummary({
      brand: "Volkswagen",
      model: "Golf",
      version: "GTI",
      color: "Preto",
      plate: "ABC-1D23",
    }),
    "Volkswagen Golf · GTI · Preto · ABC-1D23",
  );
  assert.equal(identitySummary({ brand: "", model: "" }), "Preencher marca e modelo");
  assert.equal(
    fichaSummary({
      year: "2020",
      yearModel: "2021",
      km: "42.000",
      transmission: "Automático",
      fuel: "Flex",
    }),
    "2020/2021 · 42.000 km · Automático · Flex",
  );
  assert.equal(descriptionSummary("  "), "Sem texto");
  assert.equal(descriptionSummary("a".repeat(100), 10), `${"a".repeat(9)}…`);
  assert.equal(accessoriesSummary([]), "Nenhum item marcado");
  assert.equal(
    accessoriesSummary(["Ar", "Multimídia", "Câmera", "Couro"]),
    "Ar, Multimídia, Câmera +1",
  );
});
