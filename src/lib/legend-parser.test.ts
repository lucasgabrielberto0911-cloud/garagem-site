import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LegendPasteField } from "../components/admin/LegendPasteField";
import { VehicleAccessoryChips } from "../components/site/VehicleAccessoryChips";
import { accessoryGroup, groupAccessories, legendAccessoriesError, legendText, parseLegend, sanitizeLegendText } from "./legend-parser";
import { normalizeAccessories } from "./vehicle-accessories";

const facilities = ["Aceitamos seu carro na troca", "Financiamos em até 60x"];
const fastbackComfort = [
  'Central multimídia de 10,1" com Apple CarPlay e Android Auto sem fio',
  'Painel de instrumentos digital de 7"', "Ar-condicionado digital automático",
  "Chave presencial com partida por botão", "Faróis full LED", 'Rodas de liga leve aro 18"',
  "Direção elétrica", "Vidros, travas e retrovisores elétricos",
];
const fastbackSafety = ["4 airbags", "Câmera de ré", "Sensor de estacionamento traseiro",
  "Controle de tração e de estabilidade", "Assistente de partida em rampa", "Freios ABS com EBD", "ISOFIX"];
const cases = [
  {
    name: "versa", comfort: ["Central multimídia", "Ar-condicionado", "Direção elétrica",
      "Vidros, travas e retrovisores elétricos", "Computador de bordo", "Volante com comandos de som",
      "Rodas de liga leve", "Banco traseiro amplo, com ótimo espaço para as pernas"],
    safety: ["Câmera de ré", "Airbags frontais", "Freios ABS com EBD", "ISOFIX"],
    data: { price: "64.900", km: "70.000", year: "2020", yearModel: "2020", color: "Branco",
      transmission: "Automático CVT", fuel: "Flex", engine: "1.6 16V, 111 cv" },
    description: "Sedã automático, branco e com 70 mil km. É espaçoso, econômico e confortável para o dia a dia, com central multimídia e câmera de ré, e o porta-malas de 460 litros dá conta da família e das viagens.",
  },
  {
    name: "fastback", comfort: fastbackComfort, safety: fastbackSafety,
    data: { price: "106.900", km: "24.000", year: "2023", yearModel: "2024", color: "Prata",
      transmission: "Automático CVT com 7 marchas simuladas", fuel: "Flex", engine: "1.0 Turbo 200, até 130 cv" },
    description: "SUV cupê prata, praticamente novo, com só 24 mil km. Tem visual esportivo, motor turbo econômico e um dos maiores porta-malas da categoria, com 600 litros.",
  },
];

for (const fixture of cases) {
  test(`legenda real ${fixture.name}: descrição, todos os dados e cada linha no grupo correto`, () => {
    const text = readFileSync(new URL(`./__fixtures__/legend-${fixture.name}.txt`, import.meta.url), "utf8");
    const parsed = parseLegend(text);
    assert.equal(parsed.description, fixture.description);
    assert.deepEqual(parseLegend(legendText(parsed.description, parsed.accessories, parsed.data)), parsed);
    assert.deepEqual(parsed.data, fixture.data);
    assert.deepEqual(groupAccessories(parsed.accessories).map(({ group, items }) => ({ group, items: items.map(item => accessoryGroup(item).text) })), [
      { group: "Conforto", items: fixture.comfort }, { group: "Segurança", items: fixture.safety },
      { group: "Facilidades", items: facilities },
    ]);
    assert.equal(parsed.accessories.length, fixture.comfort.length + fixture.safety.length + 2);
    assert.deepEqual(normalizeAccessories(parsed.accessories), parsed.accessories);
    assert.equal(legendAccessoriesError(parsed.accessories), "");
    assert.deepEqual(parseLegend(legendText(parsed.description, parsed.accessories)).accessories, parsed.accessories);
    assert.equal(parseLegend(legendText(parsed.description, parsed.accessories)).description, parsed.description);
  });
}

test("cada linha composta gera um único item, duplicatas não geram presets extras", () => {
  const parsed = parseLegend('Conforto:\n✅ Direção elétrica\n✅ DIRECAO ELETRICA\n✅ Vidros, travas e retrovisores elétricos\nSegurança:\n✅ Freios ABS com EBD');
  assert.deepEqual(parsed.accessories, ["Conforto: Direção elétrica", "Conforto: Vidros, travas e retrovisores elétricos", "Segurança: Freios ABS com EBD"]);
});

test("texto sem marcadores fica na descrição; detalhes desconhecidos são preservados", () => {
  assert.equal(parseLegend("Revisado e com pneus novos.\nGarantia: 1 ano").description, "Revisado e com pneus novos.\n\nGarantia: 1 ano");
  assert.deepEqual(parseLegend("✅ Equipamento exclusivo").accessories, ["Outros opcionais: Equipamento exclusivo"]);
  assert.deepEqual(parseLegend("Ano: texto incompleto").data, {});
  assert.equal(parseLegend("Ano: texto incompleto").description, "Ano: texto incompleto");
});

test("prévia recusa truncamento por tamanho ou quantidade sem cortar o resultado", () => {
  const long = parseLegend(`Conforto:\n✅ ${"Equipamento ".repeat(20).trim()}`);
  assert.ok(long.accessories[0].length > 100);
  assert.ok(legendAccessoriesError(long.accessories));
  const many = parseLegend(Array.from({ length: 61 }, (_, i) => `✅ Item ${i}`).join("\n"));
  assert.equal(many.accessories.length, 61);
  assert.ok(legendAccessoriesError(many.accessories));
  assert.equal(legendAccessoriesError(many.accessories.slice(1)), "");
});

test("prévia mostra os valores salvos; itens antigos continuam visíveis", () => {
  const noop = () => {};
  const html = renderToStaticMarkup(createElement(LegendPasteField, {
    description: "Veículo revisado", accessories: ["Conforto: Direção elétrica", "Segurança: ISOFIX", "Facilidades: Aceitamos troca"],
    data: { km: "24.000", price: "106.900", year: "2023", yearModel: "2024", color: "Prata", transmission: "CVT", fuel: "Flex", engine: "1.0" },
    onChange: noop, onRemoveDescription: noop, onRemoveItem: noop, onFieldChange: noop,
  }));
  assert.match(html, /Prévia da legenda/);
  for (const label of ["Conforto", "Segurança", "Facilidades", "Remover ISOFIX", "Remover descrição", "Remover Quilometragem"]) assert.ok(html.includes(label));
  const publicHtml = renderToStaticMarkup(createElement(VehicleAccessoryChips, { items: ["Multimídia", "Bluetooth", "Item antigo"] }));
  assert.equal((publicHtml.match(/data-accessory-chip=""/g) ?? []).length, 3);
  assert.ok(publicHtml.includes("Item antigo"));
});

test("placa, CPF, telefone, chassi e RENAVAM colados não vão para o anúncio", () => {
  const parsed = parseLegend([
    "Carro revisado e bem cuidado.",
    "Placa ABC1D23",
    "Chassi 9BWZZZ377VT004251",
    "RENAVAM: 123456789",
    "CPF 123.456.789-00",
    "Fala comigo no (27) 99988-7777",
    "✅ Ar-condicionado",
  ].join("\n"));
  assert.equal(parsed.description, "Carro revisado e bem cuidado.");
  assert.deepEqual(parsed.accessories, ["Outros opcionais: Ar-condicionado"]);
  assert.deepEqual(parsed.data, {});
  for (const label of ["placa", "chassi", "RENAVAM", "CPF", "telefone"]) {
    assert.ok(parsed.sensitive.includes(label), `avisou que tirou ${label}`);
  }
  assert.ok(!JSON.stringify(parsed).match(/ABC1D23|9BWZZZ377VT004251|123\.456\.789-00|99988-7777/));
});

test("palavra telefone ou placa sem número não derruba a linha", () => {
  const text = "Telefone sem fio\nsuporte para placa\n✅ Ar-condicionado";
  const sanitized = sanitizeLegendText(text);
  assert.ok(sanitized.clean.includes("Telefone sem fio"));
  assert.ok(sanitized.clean.includes("suporte para placa"));
  assert.deepEqual(sanitized.found, []);
  assert.equal(parseLegend(text).description.includes("Telefone sem fio"), true);
});

test("só o número sensível sai e o resto da linha fica", () => {
  const sanitized = sanitizeLegendText("Ar-condicionado (27) 99988-7777");
  assert.ok(!sanitized.clean.match(/99988-7777/));
  assert.ok(sanitized.clean.includes("Ar-condicionado"));
  assert.ok(sanitized.found.includes("telefone"));
});

test("celular com 11 dígitos seguidos é telefone, não CPF", () => {
  const phone = sanitizeLegendText("Contato 27999887777");
  assert.ok(phone.found.includes("telefone"));
  assert.ok(!phone.found.includes("CPF"));
  assert.ok(!phone.clean.match(/27999887777/));
  const cpf = sanitizeLegendText("CPF 12345678900");
  assert.ok(cpf.found.includes("CPF"));
  assert.ok(!cpf.found.includes("telefone"));
});

test("legenda limpa continua igual e sem aviso", () => {
  const text = "SUV prata com 24 mil km.\n\nConforto:\n✅ Ar-condicionado";
  const sanitized = sanitizeLegendText(text);
  assert.equal(sanitized.clean, text);
  assert.deepEqual(sanitized.found, []);
  assert.deepEqual(parseLegend(text).sensitive, []);
});

test("ficha Fastback contém 15 opcionais agrupados e facilidades fora deles", () => {
  const parsed = parseLegend(readFileSync(new URL("./__fixtures__/legend-fastback.txt", import.meta.url), "utf8"));
  const html = renderToStaticMarkup(createElement(VehicleAccessoryChips, { items: parsed.accessories }));
  assert.equal((html.match(/data-accessory-chip=""/g) ?? []).length, 15);
  for (const group of ["Conforto", "Segurança", "Facilidades"]) assert.ok(html.includes(`data-accessory-group="${group}"`));
  assert.ok(!html.includes("Conforto: Central"));
});
