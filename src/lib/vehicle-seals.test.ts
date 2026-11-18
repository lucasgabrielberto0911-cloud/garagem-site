import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { VehicleMobileSummary } from "@/components/site/VehicleMobileDossier";
import { VehicleQuickActions } from "@/components/site/VehicleQuickActions";
import { VehicleSeals } from "@/components/site/VehicleSeals";
import { publicDossierChips } from "@/lib/vehicle-dossier";
import { publicVehicleSeals, dossierSeals } from "./vehicle-seals";

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


test("dossierSeals: sem flag nenhuma, não há selo de dossiê", () => {
  assert.deepEqual(dossierSeals({}), []);
  assert.deepEqual(
    dossierSeals({ hasSpareKey: false, hasManual: false, hasVideo: false }),
    [],
  );
  assert.deepEqual(
    dossierSeals({ hasSpareKey: null, hasManual: null, hasVideo: null }),
    [],
  );
});

test("dossierSeals: só flags verdadeiras geram selo", () => {
  assert.deepEqual(dossierSeals({ hasSpareKey: true }), [
    { id: "chave-reserva", label: "Chave reserva" },
  ]);
  assert.deepEqual(dossierSeals({ hasManual: true }), [
    { id: "manual", label: "Manual do proprietário" },
  ]);
  assert.deepEqual(dossierSeals({ hasVideo: true }), [
    { id: "video", label: "Vídeo disponível" },
  ]);
});

test("dossierSeals: ordem é chave reserva, manual, vídeo", () => {
  const seals = dossierSeals({
    hasSpareKey: true,
    hasManual: true,
    hasVideo: true,
  });
  assert.deepEqual(
    seals.map((s) => s.id),
    ["chave-reserva", "manual", "video"],
  );
});

test("componente renderiza chips de publicDossierChips junto com os selos sem duplicar", () => {
  const chips = publicDossierChips({
    hasSpareKey: true,
    hasManual: true,
    hasVideo: true,
  });
  const html = renderToStaticMarkup(
    createElement(VehicleSeals, {
      seals: [{ id: "procedencia", label: "Procedência" }],
      chips,
    }),
  );
  assert.match(html, /data-vehicle-seal="procedencia"/);
  assert.match(html, /Procedência/);
  assert.match(html, /data-vehicle-seal="chave-reserva"/);
  assert.match(html, /Chave reserva/);
  assert.match(html, /data-vehicle-seal="manual"/);
  assert.match(html, /Manual do proprietário/);
  assert.match(html, /data-vehicle-seal="video"/);
  assert.match(html, /Vídeo disponível/);
});

test("VehicleMobileSummary exibe selos de dossiê apenas quando disponível", () => {
  const available = renderToStaticMarkup(
    createElement(VehicleMobileSummary, {
      title: "Honda Fit",
      price: 62900,
      sold: false,
      facts: [],
      hasSpareKey: true,
      hasManual: true,
      hasVideo: true,
    }),
  );
  assert.match(available, /Chave reserva/);
  assert.match(available, /Manual do proprietário/);
  assert.match(available, /Vídeo disponível/);

  const soldHtml = renderToStaticMarkup(
    createElement(VehicleMobileSummary, {
      title: "Honda Fit",
      price: 0,
      sold: true,
      facts: [],
      hasSpareKey: true,
      hasManual: true,
      hasVideo: true,
    }),
  );
  assert.doesNotMatch(soldHtml, /Chave reserva/);
  assert.doesNotMatch(soldHtml, /Manual do proprietário/);
  assert.doesNotMatch(soldHtml, /Vídeo disponível/);
});

test("VehicleQuickActions muda 'Pedir vídeo' para 'Ver vídeo no WhatsApp' quando hasVideo é true", () => {
  const baseProps = {
    contentId: "v-test-1",
    contentSlug: "honda-fit-2020-v-test-1",
    contentPath: "/estoque/honda-fit-2020-v-test-1",
    contentName: "Honda Fit 2020",
    value: 62900,
    make: "Honda",
    model: "Fit",
    year: 2020,
    video: "Quero vídeo",
    finance: "Quero financiar",
    trade: "Tenho troca",
  };

  const withoutVideo = renderToStaticMarkup(
    createElement(VehicleQuickActions, { ...baseProps, hasVideo: false }),
  );
  assert.match(withoutVideo, /Pedir vídeo/);
  assert.doesNotMatch(withoutVideo, /Ver vídeo no WhatsApp/);

  const withVideo = renderToStaticMarkup(
    createElement(VehicleQuickActions, { ...baseProps, hasVideo: true }),
  );
  assert.match(withVideo, /Ver vídeo no WhatsApp/);
  assert.match(withVideo, /aria-label="Ver vídeo deste veículo no WhatsApp"/);
  assert.doesNotMatch(withVideo, />Pedir vídeo</);
});
