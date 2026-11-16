import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDeliveryShowcaseItems,
  DELIVERIES_WITH_PHOTO_WHERE,
  queryDeliveriesWithPhoto,
  SOLD_VEHICLE_PUBLIC_SELECT,
  toSoldVehicleShowcaseItem,
  type DeliveryQueryArgs,
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
    {
      id: "t3",
      name: "Carla S.",
      city: null,
      message: "",
      vehicleLabel: "Corolla 2022",
      photoUrl: "https://pub-123.r2.dev/depoimentos/carla.webp",
      rating: 5,
      createdAt: null,
    },
    {
      id: "t4",
      name: "Rafael T.",
      city: null,
      message: "exemplo ilustrativo",
      vehicleLabel: "HB20 2021",
      photoUrl: "https://pub-123.r2.dev/depoimentos/rafael.webp",
      rating: 5,
      createdAt: null,
    },
  ]);

  assert.equal(items.length, 3);
  assert.equal(items[0].customerName, "Marcos A.");
  assert.equal(items[0].vehicleLabel, "Honda Civic 2020");
  assert.equal(items[0].message, "Carro impecável e entrega rápida.");
  assert.equal(items[0].photoSrc, "https://pub-123.r2.dev/depoimentos/marcos.webp");
  assert.match(items[0].whatsappHref, /^https:\/\/wa\.me\//);
  assert.equal(items[0].whatsappHref.includes("R%24"), false);

  assert.equal(items[1].customerName, "Carla S.");
  assert.equal(items[1].vehicleLabel, "Corolla 2022");
  assert.equal(items[1].message, null);

  assert.equal(items[2].customerName, "Rafael T.");
  assert.equal(items[2].vehicleLabel, "HB20 2021");
  assert.equal(items[2].message, null);
});

test("queryDeliveriesWithPhoto filtra no where, busca com folga e não esvazia a lista", async () => {
  const calls: DeliveryQueryArgs[] = [];
  const rows = [
    {
      id: "ws-1",
      name: "Invalido 1",
      city: null,
      message: "",
      vehicleLabel: null,
      photoUrl: "   ",
      rating: 5,
      createdAt: null,
    },
    {
      id: "ws-2",
      name: "Invalido 2",
      city: null,
      message: "",
      vehicleLabel: null,
      photoUrl: "\t",
      rating: 5,
      createdAt: null,
    },
    {
      id: "ok-1",
      name: "Cliente Teste 1",
      city: null,
      message: "",
      vehicleLabel: "Onix 2022",
      photoUrl: "https://pub-123.r2.dev/depoimentos/c1.webp",
      rating: 5,
      createdAt: null,
    },
    {
      id: "ok-2",
      name: "Cliente Teste 2",
      city: null,
      message: "Excelente atendimento.",
      vehicleLabel: "Civic 2020",
      photoUrl: "https://pub-123.r2.dev/depoimentos/c2.webp",
      rating: 5,
      createdAt: null,
    },
    {
      id: "ok-3",
      name: "Cliente Teste 3",
      city: null,
      message: "",
      vehicleLabel: "HB20 2021",
      photoUrl: "https://pub-123.r2.dev/depoimentos/c3.webp",
      rating: 5,
      createdAt: null,
    },
  ];

  const items = await queryDeliveriesWithPhoto(2, async (args) => {
    calls.push(args);
    return rows.slice(0, args.take);
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].where, DELIVERIES_WITH_PHOTO_WHERE);
  assert.ok(calls[0].take > 2, "deve buscar com folga antes de filtrar");
  assert.deepEqual(
    items.map((item) => item.id),
    ["ok-1", "ok-2"],
  );
  assert.equal(items[0].message, null);
  assert.equal(items[1].message, "Excelente atendimento.");

  const empty = await queryDeliveriesWithPhoto(0, async () => {
    throw new Error("não deveria consultar para take <= 0");
  });
  assert.deepEqual(empty, []);
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
