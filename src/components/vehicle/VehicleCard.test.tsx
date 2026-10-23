import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { VehicleCard } from "./VehicleCard";
import { FavoritesProvider } from "@/lib/favorites";
import type { VehicleCardRecord } from "@/lib/stock-query";

function mockVehicle(overrides: Partial<VehicleCardRecord> = {}): VehicleCardRecord {
  return {
    id: "test-vehicle-1",
    category: "moto",
    brand: "Honda",
    model: "XRE 300",
    version: "Rally ABS",
    year: 2023,
    yearModel: 2023,
    km: 12000,
    price: 28900,
    transmission: "Manual",
    fuel: "Gasolina",
    status: "disponivel",
    featured: false,
    color: "Vermelho",
    engine: "300cc",
    engineDisplacement: 300,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    photos: [{ url: "https://example.com/photo.jpg" }],
    ...overrides,
  };
}

function render(vehicle: VehicleCardRecord) {
  return renderToStaticMarkup(
    createElement(FavoritesProvider, null, createElement(VehicleCard, { vehicle }))
  );
}

test("VehicleCard exibe chips de ano e cilindrada para moto", () => {
  const html = render(mockVehicle());
  assert.match(html, /data-spec-chip="year"/);
  assert.match(html, />2023<\/span>/);
  assert.match(html, /data-spec-chip="displacement"/);
  assert.match(html, />300cc<\/span>/);
});

test("VehicleCard exibe chips de ano e cilindrada a partir de engineDisplacement e cilindrada", () => {
  const html1 = render(mockVehicle({ engineDisplacement: 300, engine: null }));
  assert.match(html1, />300cc<\/span>/);

  const html2 = render(
    mockVehicle({ cilindrada: 160, model: "CG 160", engine: null, engineDisplacement: null })
  );
  assert.match(html2, />160cc<\/span>/);
});

test("VehicleCard usa tokens de design nos chips (bg-ink, text-muted, font-body, text-xs)", () => {
  const html = render(mockVehicle());
  assert.match(html, /font-body/);
  assert.match(html, /text-xs/);
  assert.match(html, /bg-ink/);
  assert.match(html, /text-muted/);
});

test("VehicleCard em veículo vendido esconde preço mas preserva chips de especificações", () => {
  const html = render(mockVehicle({ status: "vendido", price: 28900 }));
  assert.doesNotMatch(html, /R\$\s*28\.900/);
  assert.match(html, />Vendido<\/span>/);
  assert.match(html, />2023<\/span>/);
  assert.match(html, />300cc<\/span>/);
});

test("VehicleCard mantém container responsivo flex-wrap para stack em telas mobile estreitas", () => {
  const html = render(mockVehicle());
  assert.match(html, /listing-card-chips flex flex-wrap items-center gap-1\.5/);
});
