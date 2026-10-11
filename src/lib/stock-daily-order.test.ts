import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isNewArrival,
  orderStockDaily,
  saoPauloDateKey,
} from "./stock-daily-order";

test("saoPauloDateKey formata YYYY-MM-DD no fuso de São Paulo", () => {
  // 2026-10-12 01:00 UTC = 2026-10-11 22:00 em São Paulo (UTC-3)
  const dt = new Date("2026-10-12T01:00:00Z");
  assert.equal(saoPauloDateKey(dt), "2026-10-11");

  const dtDay = new Date("2026-10-12T15:00:00Z");
  assert.equal(saoPauloDateKey(dtDay), "2026-10-12");
});

test("isNewArrival identifica veículos nos últimos 7 dias", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const exactly7Days = new Date(now.getTime() - 7 * 86400000);
  const sixDays = new Date(now.getTime() - 6 * 86400000);
  const eightDays = new Date(now.getTime() - 8 * 86400000);
  const future = new Date(now.getTime() + 10000);

  assert.equal(isNewArrival(now, now), true);
  assert.equal(isNewArrival(sixDays, now), true);
  assert.equal(isNewArrival(exactly7Days, now), true);
  assert.equal(isNewArrival(eightDays, now), false);
  assert.equal(isNewArrival(future, now), false);
});

test("mesma data produz a mesma ordem determinística", () => {
  const now = new Date("2026-10-11T12:00:00-03:00");
  const vehicles = [
    { id: "car-1", createdAt: "2026-08-01T10:00:00Z" },
    { id: "car-2", createdAt: "2026-08-02T10:00:00Z" },
    { id: "car-3", createdAt: "2026-08-03T10:00:00Z" },
    { id: "car-4", createdAt: "2026-08-04T10:00:00Z" },
    { id: "car-5", createdAt: "2026-08-05T10:00:00Z" },
  ];

  const order1 = orderStockDaily(vehicles, now).map((v) => v.id);
  const order2 = orderStockDaily(vehicles, now).map((v) => v.id);
  assert.deepEqual(order1, order2);
});

test("data diferente produz ordem diferente para >=5 não-novos", () => {
  const day1 = new Date("2026-10-11T12:00:00-03:00");
  const day2 = new Date("2026-10-12T12:00:00-03:00");
  const vehicles = [
    { id: "car-1", createdAt: "2026-08-01T10:00:00Z" },
    { id: "car-2", createdAt: "2026-08-02T10:00:00Z" },
    { id: "car-3", createdAt: "2026-08-03T10:00:00Z" },
    { id: "car-4", createdAt: "2026-08-04T10:00:00Z" },
    { id: "car-5", createdAt: "2026-08-05T10:00:00Z" },
  ];

  const orderDay1 = orderStockDaily(vehicles, day1).map((v) => v.id);
  const orderDay2 = orderStockDaily(vehicles, day2).map((v) => v.id);
  assert.notDeepEqual(orderDay1, orderDay2);
});

test("novos no topo ordenados do mais novo para o mais antigo", () => {
  const now = new Date("2026-10-11T12:00:00-03:00");
  const mixed = [
    { id: "old-1", createdAt: new Date("2026-08-01T10:00:00Z") },
    { id: "new-older", createdAt: new Date("2026-10-06T10:00:00Z") }, // 5 dias atrás
    { id: "old-2", createdAt: new Date("2026-08-02T10:00:00Z") },
    { id: "new-newest", createdAt: new Date("2026-10-10T10:00:00Z") }, // 1 dia atrás
    { id: "old-3", createdAt: new Date("2026-08-03T10:00:00Z") },
    { id: "new-middle", createdAt: new Date("2026-10-08T10:00:00Z") }, // 3 dias atrás
  ];

  const ordered = orderStockDaily(mixed, now);
  assert.equal(ordered[0]!.id, "new-newest");
  assert.equal(ordered[1]!.id, "new-middle");
  assert.equal(ordered[2]!.id, "new-older");

  const remainingIds = ordered
    .slice(3)
    .map((v) => v.id)
    .sort();
  assert.deepEqual(remainingIds, ["old-1", "old-2", "old-3"]);
});
