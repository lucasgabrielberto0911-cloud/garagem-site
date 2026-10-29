import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { VehicleMobileBlocks } from "@/components/site/VehicleMobileDossier";
import { VehicleVerifiedSection } from "@/components/site/VehicleVerifiedInfo";
import { FavoritesProvider } from "@/lib/favorites";
import { DEFAULT_GOOGLE_REVIEWS } from "@/lib/google-reviews";
import { DEFAULT_VEHICLE_CONDITIONS } from "@/lib/vehicle-conditions";
import type { VehicleConditionsContent } from "@/lib/vehicle-conditions";
import type { PublicVerifiedItem } from "@/lib/vehicle-verified";

const HINT = /Peça um vídeo pelo WhatsApp/;
const verified = [
  { key: "pneus", label: "Pneus", text: "Novos", photos: [] },
] as unknown as PublicVerifiedItem[];

function dossier(opts: { sold?: boolean; conditions?: VehicleConditionsContent }) {
  return renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleMobileBlocks as unknown as React.ComponentType<Record<string, unknown>>, {
        fullLabel: "Honda HR-V",
        path: "/estoque/hrv",
        sold: opts.sold ?? false,
        price: 84900,
        yearModel: 2016,
        make: "Honda",
        model: "HR-V",
        vehicleId: "v1",
        accessories: [],
        specs: [],
        inspection: null,
        conditions: opts.conditions ?? DEFAULT_VEHICLE_CONDITIONS,
        google: DEFAULT_GOOGLE_REVIEWS,
        prompt: "dúvida",
        verified,
      }),
    ),
  );
}

test("dica de vídeo aparece em carro à venda e some em vendido (mobile e desktop)", () => {
  assert.match(dossier({}), HINT);
  assert.doesNotMatch(dossier({ sold: true }), HINT);
  const desktop = (sold: boolean) =>
    renderToStaticMarkup(
      createElement(VehicleVerifiedSection, { items: verified, alt: "x", heading: "Verificado", sold }),
    );
  assert.match(desktop(false), HINT);
  assert.doesNotMatch(desktop(true), HINT);
});

test("introdução personalizada de condições é mantida junto dos itens; a padrão não repete", () => {
  const custom = "Condição exclusiva desta loja XYZ.";
  const withCustom = dossier({
    conditions: { ...DEFAULT_VEHICLE_CONDITIONS, intro: custom, items: [{ label: "Entrega", text: "Em casa" }] },
  });
  assert.match(withCustom, /Condição exclusiva desta loja XYZ\./);
  assert.match(withCustom, /Em casa/);

  const withDefault = dossier({});
  assert.doesNotMatch(withDefault, new RegExp(DEFAULT_VEHICLE_CONDITIONS.intro.slice(0, 40)));
});
