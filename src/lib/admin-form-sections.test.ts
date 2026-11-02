import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SECTIONS_BY_STEP,
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
    ["identificacao", "essencial", "fotos", "ficha", "itens"],
  );
  assert.equal(vehicleFormSections("create").at(-1)?.id, "operacao");
});

test("edição abre só preço/status e fotos; cadastro novo abre o que precisa preencher", () => {
  assert.deepEqual(initialOpenSections("edit"), ["essencial", "fotos"]);
  assert.deepEqual(
    initialOpenSections("edit", { descriptionNeedsAttention: true }),
    ["essencial", "fotos", "itens"],
  );
  const create = initialOpenSections("create");
  assert.ok(create.includes("identificacao"));
  assert.deepEqual(create, ["identificacao"]);
  assert.ok(!create.includes("operacao"));

  const createQuick = initialOpenSections("create", { quickMode: true });
  assert.deepEqual(createQuick, ["identificacao", "essencial", "fotos", "ficha"]);
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
    ["identificacao", "ficha", "itens"],
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
  assert.equal(
    identitySummary({ brand: "", model: "" }),
    "Preencher marca e modelo",
  );
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

test("sectionForField: mapeia todos os campos conhecidos e ignora desconhecidos", () => {
  // Identificação
  assert.equal(sectionForField("brand"), "identificacao");
  assert.equal(sectionForField("model"), "identificacao");
  assert.equal(sectionForField("version"), "identificacao");
  assert.equal(sectionForField("color"), "identificacao");
  assert.equal(sectionForField("plate"), "identificacao");
  assert.equal(sectionForField("category"), "identificacao");

  // Essencial
  assert.equal(sectionForField("price"), "essencial");
  assert.equal(sectionForField("status"), "essencial");
  assert.equal(sectionForField("locationCity"), "essencial");
  assert.equal(sectionForField("featured"), "essencial");

  // Fotos
  assert.equal(sectionForField("photos"), "fotos");

  // Ficha técnica
  assert.equal(sectionForField("year"), "ficha");
  assert.equal(sectionForField("yearModel"), "ficha");
  assert.equal(sectionForField("km"), "ficha");
  assert.equal(sectionForField("fuel"), "ficha");
  assert.equal(sectionForField("transmission"), "ficha");
  assert.equal(sectionForField("engine"), "ficha");
  assert.equal(sectionForField("doors"), "ficha");
  assert.equal(sectionForField("plateEnd"), "ficha");
  assert.equal(sectionForField("warranty"), "ficha");
  assert.equal(sectionForField("inspection"), "ficha");

  // Descrição
  assert.equal(sectionForField("description"), "itens");

  // Itens
  assert.equal(sectionForField("accessories"), "itens");

  // Operação
  assert.equal(sectionForField("purchasePrice"), "operacao");

  // Desconhecido
  assert.equal(sectionForField("outro_campo"), null);
});

test("sectionsWithErrors: agrupa múltiplos erros da mesma seção sem duplicar", () => {
  // Vários erros dentro de identificação e vários dentro de ficha
  const result = sectionsWithErrors({
    brand: "Marca obrigatória",
    model: "Modelo obrigatório",
    version: "Versão inválida",
    plate: "Placa fora do padrão",
    km: "KM obrigatório",
    fuel: "Combustível inválido",
    doors: "Portas inválidas",
  });

  assert.deepEqual(result, ["identificacao", "ficha"]);
});

test("sectionsWithErrors: cobre todas as 7 seções na ordem correta da tela", () => {
  const result = sectionsWithErrors({
    purchasePrice: "Custo inválido",
    accessories: "Mínimo de itens não atingido",
    description: "Descrição muito curta",
    km: "KM obrigatório",
    photos: "Mínimo de 3 fotos",
    price: "Preço zerado",
    brand: "Marca obrigatória",
  });

  assert.deepEqual(result, [
    "identificacao",
    "essencial",
    "fotos",
    "ficha",
    "itens",
    "operacao",
  ]);
});

test("sectionsWithErrors: ignora mensagens vazias, undefined e campos desconhecidos", () => {
  assert.deepEqual(sectionsWithErrors({}), []);
  assert.deepEqual(
    sectionsWithErrors({
      brand: undefined,
      model: "",
      campoInexistente: "Erro ignorado",
    }),
    [],
  );
});

test("vehicleFormSections: confere propriedades id, label e nav para todos os modos", () => {
  for (const mode of ["create", "edit"] as const) {
    const sections = vehicleFormSections(mode);
    for (const section of sections) {
      assert.ok(section.id.length > 0);
      assert.ok(section.label.length > 0);
      assert.ok(section.nav.length > 0);
    }
  }
});

test("detalhes dos resumos: limites e formatação", () => {
  // descriptionSummary: limite exato não coloca reticências
  assert.equal(descriptionSummary("1234567890", 10), "1234567890");
  assert.equal(descriptionSummary("12345678901", 10), "123456789…");

  // descriptionSummary: múltiplos espaços e quebras colapsam
  assert.equal(
    descriptionSummary("   Primeiro    parágrafo\n\nSegundo   "),
    "Primeiro parágrafo Segundo",
  );

  // accessoriesSummary: contagem exata no limite não adiciona +0
  assert.equal(accessoriesSummary(["A", "B", "C"], 3), "A, B, C");
  assert.equal(accessoriesSummary(["A", "B", "C", "D"], 3), "A, B, C +1");

  // fichaSummary: com ano ausente ou vazio
  assert.equal(
    fichaSummary({ year: "", yearModel: "", km: "10.000", transmission: "Manual" }),
    "10.000 km · Manual",
  );
  assert.equal(
    fichaSummary({ year: "", yearModel: "", km: "", transmission: "", fuel: "" }),
    "Ano, km, câmbio",
  );
});

test("wizard distribui cada seção uma vez nas quatro etapas", () => {
  assert.deepEqual(SECTIONS_BY_STEP, {
    1: ["fotos"],
    2: ["identificacao", "ficha"],
    3: ["essencial", "itens", "operacao"],
    4: [],
  });
  const sections = Object.values(SECTIONS_BY_STEP).flat();
  assert.equal(new Set(sections).size, sections.length);
  assert.deepEqual([...sections].sort(), vehicleFormSections("create").map(s => s.id).sort());
});
