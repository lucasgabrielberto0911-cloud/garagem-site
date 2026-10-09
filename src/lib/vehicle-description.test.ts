import assert from "node:assert/strict";
import { test } from "node:test";
import { parseVehicleDescription, withoutRepeatedDescriptionFacts } from "./vehicle-description";

test("descrição com quebras vira fatos e parágrafo, sem perder o texto", () => {
  const raw = [
    "🔥 NOVIDADE NO ESTOQUE DA GARAGEM!",
    "",
    "🚗 Honda Civic Sedan LXR 2.0 FlexOne — 2014/2015",
    "",
    "💲 Valor: R$ 74.900",
    "",
    "Sedã médio automático, motor 2.0 e acabamento LXR — conforto e presença com preço alinhado à tabela.",
    "",
    "📊 Quilometragem: 106.000 km",
    "📅 Ano: 2014/2015",
  ].join("\n");

  const segments = parseVehicleDescription(raw);
  assert.deepEqual(
    segments.map((segment) => segment.kind),
    ["facts", "prose", "facts"],
  );

  const opening = segments[0];
  assert.equal(opening?.kind, "facts");
  if (opening?.kind === "facts") {
    assert.equal(opening.lines[0]?.emoji, "🔥");
    assert.equal(opening.lines[0]?.text, "NOVIDADE NO ESTOQUE DA GARAGEM!");
    assert.match(opening.lines[2]?.text ?? "", /R\$ 74\.900/);
  }

  const prose = segments[1];
  assert.equal(prose?.kind, "prose");
  if (prose?.kind === "prose") {
    assert.match(prose.text, /Sedã médio automático/);
  }

  const specs = segments[2];
  assert.equal(specs?.kind, "facts");
  if (specs?.kind === "facts") {
    assert.match(specs.lines.map((line) => line.text).join(" "), /106\.000 km/);
    assert.match(specs.lines.map((line) => line.text).join(" "), /2014\/2015/);
  }
});

test("texto corrido sem quebra continua um parágrafo", () => {
  assert.deepEqual(
    parseVehicleDescription("Golf GTI impecável, único dono, revisões em dia."),
    [
      {
        kind: "prose",
        text: "Golf GTI impecável, único dono, revisões em dia.",
      },
    ],
  );
});


test("resumo retira só preço, ano e km idênticos; notas e valores divergentes permanecem", () => {
  const raw = [
    "💲 Valor: R$ 74.900,00",
    "📊 Quilometragem: 106.000 km",
    "📅 Ano: 2014/2015",
    "📅 Ano: 2015",
    "💲 Valor: R$ 75.000",
    "💲 Valor: R$ 74.900 à vista",
    "📊 Quilometragem: 106.000 km, revisões em dia",
    "📅 Ano: 2013/2015",
    "",
    "O preço e a quilometragem estão no anúncio; combine uma visita.",
  ].join("\n");
  const segments = parseVehicleDescription(raw);
  const original = JSON.stringify(segments);
  const result = withoutRepeatedDescriptionFacts(segments, {price:74900, km:106000, year:2014, yearModel:2015});
  assert.equal(JSON.stringify(segments), original);
  assert.equal(result[0].kind, "facts");
  if (result[0].kind === "facts") {
    assert.deepEqual(result[0].lines.map(line => line.text), [
      "Valor: R$ 75.000", "Valor: R$ 74.900 à vista", "Quilometragem: 106.000 km, revisões em dia", "Ano: 2013/2015",
    ]);
  }
  assert.deepEqual(result[1], segments[1]);
  assert.deepEqual(withoutRepeatedDescriptionFacts(segments), segments);
});

test("bloco só de fatos repetidos não deixa espaço vazio e aceita km zero", () => {
  assert.deepEqual(withoutRepeatedDescriptionFacts(parseVehicleDescription("📊 Km: 0 km"), {price:100, km:0, year:2025, yearModel:2025}), []);
});
