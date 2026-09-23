import assert from "node:assert/strict";
import { test } from "node:test";
import { parseVehicleDescription } from "./vehicle-description";

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
