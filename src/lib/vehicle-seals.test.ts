import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { VehicleSeals } from "@/components/site/VehicleSeals";
import { publicVehicleSeals } from "./vehicle-seals";

test("sem dado nenhum, não há selo", () => {
  assert.deepEqual(publicVehicleSeals({ verified: [], accessories: [] }), []);
  assert.deepEqual(
    publicVehicleSeals({
      verified: [
        { key: "documentacao", text: "   " },
        { key: "manutencao", text: "" },
      ],
      accessories: ["  ", ""],
    }),
    [],
  );
});

test("procedência e revisões vêm só dos textos verificados da loja", () => {
  assert.deepEqual(
    publicVehicleSeals({
      verified: [{ key: "documentacao", text: "IPVA 2026 pago, sem multas" }],
      accessories: [],
    }),
    [{ id: "procedencia", label: "Procedência" }],
  );
  assert.deepEqual(
    publicVehicleSeals({
      verified: [{ key: "manutencao", text: "Revisão aos 58 mil km" }],
      accessories: [],
    }),
    [{ id: "revisoes", label: "Revisões" }],
  );
  assert.deepEqual(
    publicVehicleSeals({
      verified: [{ key: "pneus", text: "4 pneus novos" }],
      accessories: [],
    }),
    [],
  );
});

test("opcionais mostram a contagem de itens, no singular e no plural", () => {
  assert.deepEqual(
    publicVehicleSeals({ verified: [], accessories: ["Bluetooth"] }),
    [{ id: "opcionais", label: "1 opcional" }],
  );
  assert.deepEqual(
    publicVehicleSeals({ verified: [], accessories: ["Bluetooth", " ", "USB", "Câmera de ré"] }),
    [{ id: "opcionais", label: "3 opcionais" }],
  );
});

test("a ordem dos selos é procedência, revisões e opcionais", () => {
  const seals = publicVehicleSeals({
    verified: [
      { key: "manutencao", text: "Revisão em concessionária" },
      { key: "documentacao", text: "Documentação em dia" },
    ],
    accessories: ["Bluetooth"],
  });
  assert.deepEqual(
    seals.map((seal) => seal.id),
    ["procedencia", "revisoes", "opcionais"],
  );
});

test("componente de selos não renderiza sem selo e lista os que existem", () => {
  assert.equal(renderToStaticMarkup(createElement(VehicleSeals, { seals: [] })), "");

  const html = renderToStaticMarkup(
    createElement(VehicleSeals, {
      seals: [
        { id: "revisoes", label: "Revisões" },
        { id: "opcionais", label: "2 opcionais" },
      ],
    }),
  );
  assert.match(html, /data-vehicle-seal="revisoes"/);
  assert.match(html, /Revisões/);
  assert.match(html, /2 opcionais/);
  assert.doesNotMatch(html, /Procedência/);
});
