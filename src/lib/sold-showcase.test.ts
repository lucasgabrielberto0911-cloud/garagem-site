import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDeliveryShowcaseItems,
  SOLD_VEHICLE_PUBLIC_SELECT,
  toSoldVehicleShowcaseItem,
} from "./sold-showcase";

test("SOLD_VEHICLE_PUBLIC_SELECT nunca seleciona preço, placa ou cidade", () => {
  const keys = Object.keys(SOLD_VEHICLE_PUBLIC_SELECT);
  for (const forbidden of [
    "price",
    "fipePrice",
    "purchasePrice",
    "plate",
    "chassis",
    "renavam",
    "locationCity",
    "consigned",
  ]) {
    assert.equal(keys.includes(forbidden), false, `${forbidden} não pode ser selecionado`);
  }
});

test("buildDeliveryShowcaseItems filtra entradas sem foto e monta link de similar", () => {
  const items = buildDeliveryShowcaseItems([
    {
      id: "t1",
      name: "Marcos A.",
      city: "Linhares - ES",
      message: "Carro impecável e entrega rápida.",
      vehicleLabel: "Honda Civic 2020",
      photoUrl: "https://pub-123.r2.dev/depoimentos/marcos.webp",
      rating: 5,
      createdAt: "2026-10-15T12:00:00Z",
    },
    {
      id: "t2",
      name: "Sem Foto",
      city: null,
      message: "Ótimo atendimento.",
      vehicleLabel: "Onix 2021",
      photoUrl: null,
      rating: 5,
      createdAt: null,
    },
  ]);

  assert.equal(items.length, 1);
  assert.equal(items[0].customerName, "Marcos A.");
  assert.equal(items[0].vehicleLabel, "Honda Civic 2020");
  assert.equal(items[0].photoSrc, "https://pub-123.r2.dev/depoimentos/marcos.webp");
  assert.match(items[0].whatsappHref, /^https:\/\/wa\.me\//);
  assert.equal(items[0].whatsappHref.includes("R%24"), false);
});

test("toSoldVehicleShowcaseItem omite preço e gera mensagem de veículo vendido no WhatsApp", () => {
  const item = toSoldVehicleShowcaseItem({
    id: "cmwfn7t5q000jov81e761x7ay",
    category: "carro",
    brand: "honda",
    model: "civic",
    version: "EXL 2.0",
    year: 2020,
    yearModel: 2021,
    km: 48500,
    transmission: "Automatico",
    fuel: "Flex",
    updatedAt: "2026-10-20T10:00:00Z",
    photos: [
      {
        url: "https://pub-123.r2.dev/civic.webp",
        thumbnailUrl: "https://pub-123.r2.dev/civic-card.webp",
      },
    ],
  });

  assert.equal("price" in item, false);
  assert.equal(item.brand, "Honda");
  assert.equal(item.model, "Civic");
  assert.equal(item.kmLabel, "48.500 km");
  assert.match(item.path, /^\/estoque\/honda-civic-/);
  const text = new URL(item.whatsappHref).searchParams.get("text") ?? "";
  assert.match(text, /vendido/i);
  assert.equal(text.includes("R$"), false);
});
