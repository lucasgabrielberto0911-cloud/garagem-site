import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ParkedVehiclesList } from "@/components/admin/ParkedVehiclesList";
import {
  PARKED_MIN_DAYS,
  PARKED_VEHICLE_SELECT,
  SITE_VISIT_ACTION,
  calculateParkedDays,
  filterParkedVehicles,
  parkedCutoffDate,
  resolveVehicleEnteredAt,
  type ParkedVehicleCandidate,
} from "./admin-parados";
import { loadParkedVehicles } from "./admin-parados-store";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-17T15:00:00.000Z");

function daysAgo(days: number, extraMs = 0) {
  return new Date(NOW.getTime() - days * DAY_MS - extraMs);
}

test("calculateParkedDays calcula dias completos desde a entrada e trata datas inválidas ou futuras", () => {
  assert.equal(calculateParkedDays(NOW, NOW), 0);
  assert.equal(calculateParkedDays(daysAgo(15), NOW), 15);
  assert.equal(calculateParkedDays(daysAgo(30), NOW), 30);
  assert.equal(calculateParkedDays(daysAgo(30, 12 * 3600_000), NOW), 30);
  assert.equal(calculateParkedDays(daysAgo(31), NOW), 31);
  assert.equal(calculateParkedDays(daysAgo(75).toISOString(), NOW), 75);
  assert.equal(calculateParkedDays(new Date(NOW.getTime() + DAY_MS), NOW), 0);
  assert.equal(calculateParkedDays("data-invalida", NOW), 0);
});

test("resolveVehicleEnteredAt prioriza stockEnteredAt quando presente e cai em createdAt", () => {
  const createdAt = daysAgo(20);
  const stockEnteredAt = daysAgo(45);

  assert.equal(
    resolveVehicleEnteredAt({ createdAt, stockEnteredAt }).getTime(),
    stockEnteredAt.getTime(),
  );
  assert.equal(
    resolveVehicleEnteredAt({ createdAt, stockEnteredAt: null }).getTime(),
    createdAt.getTime(),
  );
  assert.equal(
    resolveVehicleEnteredAt({ createdAt }).getTime(),
    createdAt.getTime(),
  );
});

test("parkedCutoffDate casa exatamente com o filtro estrito de mais de 30 dias", () => {
  const cutoff = parkedCutoffDate(PARKED_MIN_DAYS, NOW);
  const almost31Days = new Date(cutoff.getTime() + 1);
  const exact31Days = new Date(cutoff.getTime());

  assert.equal(calculateParkedDays(almost31Days, NOW), 30);
  assert.equal(calculateParkedDays(exact31Days, NOW), 31);
});

test("filterParkedVehicles mantém apenas disponíveis (> 30 dias, não vendidos/reservados/históricos) e ordena desc", () => {
  const candidates: ParkedVehicleCandidate[] = [
    {
      id: "cm0000000000000000000001",
      brand: "Toyota",
      model: "Corolla",
      version: "XEi 2.0",
      yearModel: 2021,
      price: 119900,
      status: "disponivel",
      historical: false,
      createdAt: daysAgo(42),
    },
    {
      id: "cm0000000000000000000002",
      brand: "Honda",
      model: "Civic",
      version: "EXL 2.0",
      yearModel: 2020,
      price: 114900,
      status: "disponivel",
      historical: false,
      createdAt: daysAgo(68),
    },
    {
      id: "cm0000000000000000000003",
      brand: "Hyundai",
      model: "HB20",
      version: "Comfort 1.0",
      yearModel: 2022,
      price: 69900,
      status: "disponivel",
      historical: false,
      createdAt: daysAgo(30, 23 * 3600_000), // 30 dias e 23h -> ainda 30 dias completos, não entra
    },
    {
      id: "cm0000000000000000000004",
      brand: "Volkswagen",
      model: "Polo",
      version: "Highline 200 TSI",
      yearModel: 2023,
      price: 98900,
      status: "disponivel",
      historical: false,
      createdAt: daysAgo(31), // 31 dias -> entra
    },
    {
      id: "cm0000000000000000000005",
      brand: "Chevrolet",
      model: "Onix",
      version: "LT 1.0",
      yearModel: 2021,
      price: 65900,
      status: "vendido",
      historical: false,
      createdAt: daysAgo(90),
    },
    {
      id: "cm0000000000000000000006",
      brand: "Jeep",
      model: "Compass",
      version: "Longitude",
      yearModel: 2022,
      price: 134900,
      status: "reservado",
      historical: false,
      createdAt: daysAgo(85),
    },
    {
      id: "cm0000000000000000000007",
      brand: "Fiat",
      model: "Argo",
      version: "Drive 1.3",
      yearModel: 2020,
      price: 59900,
      status: "disponivel",
      historical: true,
      createdAt: daysAgo(120),
    },
    {
      id: "cm0000000000000000000008",
      brand: "Nissan",
      model: "Kicks",
      version: "Advance",
      yearModel: 2022,
      price: 108900,
      status: "disponivel",
      historical: false,
      createdAt: daysAgo(42, 6 * 3600_000), // Mesmo dia inteiro (42), mas 6h mais antigo que o Corolla
    },
  ];

  const views = new Map<string, number>([
    ["cm0000000000000000000002", 37],
    ["cm0000000000000000000008", 12],
  ]);

  const result = filterParkedVehicles(candidates, {
    now: NOW,
    viewsByVehicleId: views,
  });

  assert.deepEqual(
    result.map((item) => [item.id, item.daysParked, item.views]),
    [
      ["cm0000000000000000000002", 68, 37],
      ["cm0000000000000000000008", 42, 12],
      ["cm0000000000000000000001", 42, 0],
      ["cm0000000000000000000004", 31, 0],
    ],
  );
});

test("segurança e privacidade: select, itens e HTML nunca expõem placa, chassi ou RENAVAM, e a página exige sessão", () => {
  const selectKeys = Object.keys(PARKED_VEHICLE_SELECT);
  for (const forbidden of ["plate", "plateEnd", "chassis", "renavam"]) {
    assert.equal(selectKeys.includes(forbidden), false);
  }

  const candidateWithSecrets = {
    id: "cm0000000000000000000099",
    brand: "Ford",
    model: "Ka",
    version: "SE 1.0",
    yearModel: 2020,
    price: 49900,
    status: "disponivel",
    historical: false,
    createdAt: daysAgo(50),
    plate: "ABC1D23",
    chassis: "9BFZH55L0L8000000",
    renavam: "00123456789",
  } as ParkedVehicleCandidate;

  const items = filterParkedVehicles([candidateWithSecrets], {
    now: NOW,
    viewsByVehicleId: { cm0000000000000000000099: 19 },
  });

  assert.equal(items.length, 1);
  const serialized = JSON.stringify(items);
  assert.equal(serialized.includes("ABC1D23"), false);
  assert.equal(serialized.includes("9BFZH55L0L8000000"), false);
  assert.equal(serialized.includes("00123456789"), false);

  const html = renderToStaticMarkup(
    createElement(ParkedVehiclesList, { items }),
  );
  assert.match(html, /Ford Ka SE 1\.0 2020/);
  assert.match(html, /50 dias/);
  assert.match(html, /49\.900/);
  assert.match(html, /19/);
  assert.equal(html.includes("ABC1D23"), false);
  assert.equal(html.includes("9BFZH55L0L8000000"), false);
  assert.equal(html.includes("00123456789"), false);
  assert.equal(/yellow|dourad/i.test(html), false);

  const emptyHtml = renderToStaticMarkup(
    createElement(ParkedVehiclesList, { items: [] }),
  );
  assert.match(emptyHtml, /Nenhum carro parado há mais de 30 dias/);

  const pageSource = readFileSync("src/app/admin/parados/page.tsx", "utf8");
  assert.match(pageSource, /getSession\(\)/);
  assert.match(pageSource, /redirect\("\/admin\/login"\)/);
});

test("loadParkedVehicles agrega site:visita de AdminAudit apenas para carros parados e tolera tabela opcional ausente", async () => {
  let queriedAuditIds: string[] = [];
  let queriedAction = "";

  const report = await loadParkedVehicles(
    {
      vehicle: {
        findMany: async () => [
          {
            id: "cm0000000000000000000010",
            brand: "Honda",
            model: "HR-V",
            version: "EXL",
            yearModel: 2021,
            price: 124900,
            status: "disponivel",
            historical: false,
            createdAt: daysAgo(48),
          },
          {
            id: "cm0000000000000000000011",
            brand: "Fiat",
            model: "Pulse",
            version: "Audace",
            yearModel: 2023,
            price: 99900,
            status: "disponivel",
            historical: false,
            createdAt: daysAgo(12),
          },
        ],
      },
      vehicleAcquisitionMetadata: {
        findMany: async () => {
          throw new Error("relation VehicleAcquisitionMetadata does not exist");
        },
      },
      adminAudit: {
        groupBy: async (args) => {
          queriedAuditIds = args.where.entityId.in;
          queriedAction = args.where.action;
          return [
            {
              entityId: "cm0000000000000000000010",
              _count: { _all: 24 },
            },
          ];
        },
      },
    },
    NOW,
  );

  assert.equal(queriedAction, SITE_VISIT_ACTION);
  assert.deepEqual(queriedAuditIds, ["cm0000000000000000000010"]);
  assert.equal(report.viewsAvailable, true);
  assert.equal(report.totalValue, 124900);
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].daysParked, 48);
  assert.equal(report.items[0].views, 24);
});
