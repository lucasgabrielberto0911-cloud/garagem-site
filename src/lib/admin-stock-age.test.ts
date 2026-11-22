import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyStockAgeBand, summarizeStockAge } from "./admin-stock-age";

function daysAgo(days: number, now: Date) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

test("classifyStockAgeBand respeita os limites 0-30, 31-45, 46-60 e 60+", () => {
  assert.equal(classifyStockAgeBand(0), "0-30");
  assert.equal(classifyStockAgeBand(30), "0-30");
  assert.equal(classifyStockAgeBand(31), "31-45");
  assert.equal(classifyStockAgeBand(45), "31-45");
  assert.equal(classifyStockAgeBand(46), "46-60");
  assert.equal(classifyStockAgeBand(60), "46-60");
  assert.equal(classifyStockAgeBand(61), "60+");
});

test("summarizeStockAge usa stockEnteredAt ?? createdAt, ignora vendido/reservado/histórico e lista os 3 mais antigos", () => {
  const now = new Date("2026-11-21T15:00:00Z");
  const summary = summarizeStockAge(
    [
      {
        id: "v1",
        brand: "Fiat",
        model: "Argo",
        yearModel: 2022,
        status: "disponivel",
        createdAt: daysAgo(15, now),
      },
      {
        id: "v2",
        brand: "VW",
        model: "Polo",
        yearModel: 2021,
        status: "disponivel",
        createdAt: daysAgo(90, now),
        stockEnteredAt: daysAgo(35, now),
      },
      {
        id: "v3",
        brand: "Hyundai",
        model: "HB20",
        yearModel: 2020,
        status: "disponivel",
        createdAt: daysAgo(50, now),
      },
      {
        id: "v4",
        brand: "Toyota",
        model: "Corolla",
        yearModel: 2022,
        status: "disponivel",
        createdAt: daysAgo(75, now),
      },
      {
        id: "v5",
        brand: "Honda",
        model: "Civic",
        yearModel: 2020,
        status: "reservado",
        createdAt: daysAgo(80, now),
      },
      {
        id: "v6",
        brand: "Chevrolet",
        model: "Onix",
        yearModel: 2021,
        status: "vendido",
        createdAt: daysAgo(95, now),
      },
      {
        id: "v7",
        brand: "Jeep",
        model: "Compass",
        yearModel: 2022,
        status: "disponivel",
        historical: true,
        createdAt: daysAgo(100, now),
      },
    ],
    now,
  );

  assert.equal(summary.totalActive, 4);
  assert.deepEqual(
    summary.bands.map((band) => ({ id: band.id, count: band.count })),
    [
      { id: "0-30", count: 1 },
      { id: "31-45", count: 1 },
      { id: "46-60", count: 1 },
      { id: "60+", count: 1 },
    ],
  );
  assert.deepEqual(
    summary.oldest.map((item) => ({ id: item.id, days: item.days })),
    [
      { id: "v4", days: 75 },
      { id: "v3", days: 50 },
      { id: "v2", days: 35 },
    ],
  );
});
