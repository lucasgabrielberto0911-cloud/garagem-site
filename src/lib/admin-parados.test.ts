import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ParkedVehiclesList } from "@/components/admin/ParkedVehiclesList";
import {
  PARKED_METRICS_WINDOW_DAYS,
  PARKED_MIN_DAYS,
  PARKED_RECENT_VISITS_DAYS,
  PARKED_VEHICLE_SELECT,
  SITE_VISIT_ACTION,
  SITE_WHATSAPP_ACTION,
  calculateParkedDays,
  filterParkedVehicles,
  formatFipeComparison,
  parkedCutoffDate,
  parkedFunnelReading,
  resolveVehicleEnteredAt,
  type ParkedVehicleCandidate,
} from "./admin-parados";
import { loadParkedVehicles } from "./admin-parados-store";
import { groupParkedByAgeBand } from "./admin-stock-age";

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

test("formatFipeComparison só compara quando há FIPE salva e preço válido", () => {
  assert.equal(formatFipeComparison(100000, null), null);
  assert.equal(formatFipeComparison(100000, 0), null);
  assert.equal(formatFipeComparison(0, 100000), null);

  const above = formatFipeComparison(110000, 100000);
  assert.ok(above);
  assert.equal(above.diffPercent, 10);
  assert.equal(above.deltaLabel, "+10% da FIPE");
  assert.equal(above.tone, "brand");

  const below = formatFipeComparison(95000, 100000);
  assert.ok(below);
  assert.equal(below.diffPercent, -5);
  assert.equal(below.deltaLabel, "-5% da FIPE");
  assert.equal(below.tone, "success");

  const equal = formatFipeComparison(100000, 100000);
  assert.ok(equal);
  assert.equal(equal.diffPercent, 0);
  assert.equal(equal.deltaLabel, "na FIPE");
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
      fipePrice: 115000,
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
      fipePrice: null,
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
      createdAt: daysAgo(30, 23 * 3600_000),
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
      createdAt: daysAgo(31),
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
      createdAt: daysAgo(42, 6 * 3600_000),
    },
  ];

  const views = new Map<string, number>([
    ["cm0000000000000000000002", 37],
    ["cm0000000000000000000008", 12],
  ]);
  const whatsapp = new Map<string, number>([
    ["cm0000000000000000000002", 4],
  ]);

  const result = filterParkedVehicles(candidates, {
    now: NOW,
    viewsByVehicleId: views,
    whatsappByVehicleId: whatsapp,
  });

  assert.deepEqual(
    result.map((item) => [
      item.id,
      item.daysParked,
      item.views,
      item.whatsappClicks,
      item.fipePrice,
    ]),
    [
      ["cm0000000000000000000002", 68, 37, 4, null],
      ["cm0000000000000000000008", 42, 12, 0, null],
      ["cm0000000000000000000001", 42, 0, 0, 115000],
      ["cm0000000000000000000004", 31, 0, 0, null],
    ],
  );
});

test("groupParkedByAgeBand agrupa em 60+, 46-60 e 31-45 com sugestões corretas", () => {
  const items = filterParkedVehicles(
    [
      {
        id: "v31",
        brand: "VW",
        model: "Polo",
        yearModel: 2023,
        price: 90000,
        status: "disponivel",
        createdAt: daysAgo(35),
      },
      {
        id: "v50",
        brand: "Honda",
        model: "HR-V",
        yearModel: 2021,
        price: 120000,
        status: "disponivel",
        createdAt: daysAgo(50),
      },
      {
        id: "v70",
        brand: "Toyota",
        model: "Corolla",
        yearModel: 2020,
        price: 115000,
        status: "disponivel",
        createdAt: daysAgo(70),
      },
    ],
    { now: NOW },
  );

  const groups = groupParkedByAgeBand(items);
  assert.deepEqual(
    groups.map((g) => ({
      id: g.id,
      suggestion: g.suggestion,
      ids: g.items.map((item) => item.id),
    })),
    [
      {
        id: "60+",
        suggestion: "Decidir: vender no preço ou repassar",
        ids: ["v70"],
      },
      {
        id: "46-60",
        suggestion: "Baixar preço e divulgar",
        ids: ["v50"],
      },
      {
        id: "31-45",
        suggestion: "Rever preço e trocar capa",
        ids: ["v31"],
      },
    ],
  );
});

test("parkedFunnelReading gera leitura simples sem IA conforme visitas e cliques", () => {
  assert.equal(
    parkedFunnelReading({
      views30d: 25,
      whatsappClicks: 0,
      viewsAvailable: false,
    }),
    null,
  );

  const highViewsLowClicks = parkedFunnelReading({
    views30d: 25,
    whatsappClicks: 1,
  });
  assert.deepEqual(highViewsLowClicks, {
    kind: "high-views-low-clicks",
    label: "Muita visita e pouco clique → rever preço ou fotos",
    tone: "brand",
  });

  const lowViews = parkedFunnelReading({
    views30d: 4,
    whatsappClicks: 0,
  });
  assert.deepEqual(lowViews, {
    kind: "low-views",
    label: "Pouca visita → divulgar mais",
    tone: "neutral",
  });

  // Bom volume e boa taxa de cliques -> sem alerta
  assert.equal(
    parkedFunnelReading({
      views30d: 20,
      whatsappClicks: 3,
    }),
    null,
  );
});

test("segurança, privacidade e UI: select e HTML nunca expõem placa/chassi/RENAVAM, mostram faixas, FIPE só quando existe, leitura simples e ações rápidas", () => {
  const selectKeys = Object.keys(PARKED_VEHICLE_SELECT);
  for (const forbidden of ["plate", "plateEnd", "chassis", "renavam"]) {
    assert.equal(selectKeys.includes(forbidden), false);
  }
  assert.equal(PARKED_VEHICLE_SELECT.featured, true);

  const candidateWithFipe = {
    id: "cm0000000000000000000099",
    brand: "Ford",
    model: "Ka",
    version: "SE 1.0",
    yearModel: 2020,
    price: 55000,
    fipePrice: 50000,
    featured: false,
    status: "disponivel",
    historical: false,
    createdAt: daysAgo(50),
    plate: "ABC1D23",
    chassis: "9BFZH55L0L8000000",
    renavam: "00123456789",
  } as ParkedVehicleCandidate;

  const candidateWithoutFipe = {
    id: "cm0000000000000000000100",
    brand: "Toyota",
    model: "Corolla",
    version: "XEi",
    yearModel: 2022,
    price: 125000,
    fipePrice: null,
    featured: true,
    status: "disponivel",
    historical: false,
    createdAt: daysAgo(72),
  } as ParkedVehicleCandidate;

  const items = filterParkedVehicles([candidateWithFipe, candidateWithoutFipe], {
    now: NOW,
    viewsByVehicleId: {
      cm0000000000000000000099: 19,
      cm0000000000000000000100: 3,
    },
    views7dByVehicleId: {
      cm0000000000000000000099: 7,
      cm0000000000000000000100: 1,
    },
    whatsappByVehicleId: {
      cm0000000000000000000099: 0,
      cm0000000000000000000100: 0,
    },
  });

  assert.equal(items.length, 2);
  const serialized = JSON.stringify(items);
  assert.equal(serialized.includes("ABC1D23"), false);
  assert.equal(serialized.includes("9BFZH55L0L8000000"), false);
  assert.equal(serialized.includes("00123456789"), false);

  const html = renderToStaticMarkup(
    createElement(ParkedVehiclesList, { items, featuredCount: 1 }),
  );
  // Faixas e sugestões na ordem mais urgente -> menos urgente
  assert.ok(html.indexOf("60+ dias") < html.indexOf("46–60 dias"));
  assert.match(html, /Decidir: vender no preço ou repassar/);
  assert.match(html, /Baixar preço e divulgar/);
  assert.match(html, /Ford Ka SE 1\.0 2020/);
  assert.match(html, /50 dias/);
  assert.match(html, /55\.000/);
  assert.match(html, /\+10% da FIPE/);
  assert.match(html, /19/);
  assert.match(html, /7 nos últimos 7d/);
  assert.match(html, /Cliques WhatsApp \(30d\)/);
  assert.match(html, /Muita visita e pouco clique → rever preço ou fotos/);
  assert.match(html, /Pouca visita → divulgar mais/);
  assert.match(html, /Alterar preço/);
  assert.match(html, /Trocar capa/);
  assert.match(html, /\?view=fotos/);
  assert.match(html, /Fixar na home/);
  assert.match(html, /Fixado na home/);
  assert.match(html, /Abrir ficha do carro/);
  assert.match(html, /Ver no site/);
  assert.equal(html.includes("ABC1D23"), false);
  assert.equal(html.includes("9BFZH55L0L8000000"), false);
  assert.equal(html.includes("00123456789"), false);
  assert.equal(/yellow|dourad|parcela/i.test(html), false);

  // Sem FIPE não inventa FIPE
  const noFipeHtml = renderToStaticMarkup(
    createElement(ParkedVehiclesList, { items: [items[0]], featuredCount: 1 }),
  );
  assert.equal(/FIPE/.test(noFipeHtml), false);

  const emptyHtml = renderToStaticMarkup(
    createElement(ParkedVehiclesList, { items: [] }),
  );
  assert.match(emptyHtml, /Nenhum carro parado há mais de 30 dias/);
  assert.match(emptyHtml, /estoque está girando bem/);

  const pageSource = readFileSync("src/app/admin/parados/page.tsx", "utf8");
  assert.match(pageSource, /getSession\(\)/);
  assert.match(pageSource, /redirect\("\/admin\/login"\)/);
});

test("loadParkedVehicles agrega site:visita e site:whatsapp com janela de 30d e visitas 7d, calcula faixas e featuredCount", async () => {
  const auditCalls: Array<{
    ids: string[];
    actions: string[];
    since: Date;
  }> = [];

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
            fipePrice: 120000,
            featured: true,
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
            fipePrice: null,
            featured: true,
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
          auditCalls.push({
            ids: args.where.entityId.in,
            actions: args.where.action.in,
            since: args.where.createdAt.gte,
          });
          if (args.where.action.in.includes(SITE_WHATSAPP_ACTION)) {
            return [
              {
                entityId: "cm0000000000000000000010",
                action: SITE_VISIT_ACTION,
                _count: { _all: 24 },
              },
              {
                entityId: "cm0000000000000000000010",
                action: SITE_WHATSAPP_ACTION,
                _count: { _all: 5 },
              },
            ];
          }
          return [
            {
              entityId: "cm0000000000000000000010",
              action: SITE_VISIT_ACTION,
              _count: { _all: 6 },
            },
          ];
        },
      },
    },
    NOW,
  );

  assert.equal(auditCalls.length, 2);
  const call30d = auditCalls.find((c) =>
    c.actions.includes(SITE_WHATSAPP_ACTION),
  );
  const call7d = auditCalls.find(
    (c) => !c.actions.includes(SITE_WHATSAPP_ACTION),
  );
  assert.ok(call30d);
  assert.ok(call7d);
  assert.deepEqual(call30d.ids, ["cm0000000000000000000010"]);
  assert.deepEqual(call7d.ids, ["cm0000000000000000000010"]);
  assert.equal(
    call30d.since.getTime(),
    NOW.getTime() - PARKED_METRICS_WINDOW_DAYS * DAY_MS,
  );
  assert.equal(
    call7d.since.getTime(),
    NOW.getTime() - PARKED_RECENT_VISITS_DAYS * DAY_MS,
  );

  assert.equal(report.viewsAvailable, true);
  assert.equal(report.featuredCount, 2);
  assert.equal(report.totalValue, 124900);
  assert.deepEqual(report.bandCounts, {
    "0-30": 1,
    "31-45": 0,
    "46-60": 1,
    "60+": 0,
  });
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].daysParked, 48);
  assert.equal(report.items[0].views, 24);
  assert.equal(report.items[0].views7d, 6);
  assert.equal(report.items[0].whatsappClicks, 5);
  assert.equal(report.items[0].fipePrice, 120000);
  assert.equal(report.items[0].featured, true);
});
