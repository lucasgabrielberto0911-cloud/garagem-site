import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DASHBOARD_ALERTS_VISIBLE,
  buildDashboardAlerts,
  splitDashboardAlerts,
  type DashboardAlertsInput,
} from "./admin-dashboard";

const empty: DashboardAlertsInput = {
  usingSeedPassword: false,
  withoutPhotos: [],
  noFeatured: false,
  staleVehicles: [],
  staleDays: 45,
  placeholders: [],
  noTestimonials: false,
  noGoogleReviews: false,
};

test("sem pendência, lista vazia", () => {
  assert.deepEqual(buildDashboardAlerts(empty), []);
});

test("senha e anúncio sem foto vêm antes de ajuste de cadastro da loja", () => {
  const alerts = buildDashboardAlerts({
    ...empty,
    noGoogleReviews: true,
    placeholders: ["WhatsApp"],
    staleVehicles: [{ id: "s1", brand: "Fiat", model: "Uno", days: 90 }],
    noFeatured: true,
    withoutPhotos: [{ id: "p1", brand: "VW", model: "Gol" }],
    usingSeedPassword: true,
  });
  assert.deepEqual(
    alerts.map((alert) => alert.key),
    [
      "seed-password",
      "no-photo-p1",
      "no-featured",
      "stale-s1",
      "placeholders",
      "no-google-reviews",
    ],
  );
  assert.equal(alerts[1].href, "/admin/veiculos/p1");
  assert.equal(alerts[3].title, "Fiat Uno há 90 dias no estoque");
  assert.match(alerts[3].description, /45 dias/);
});

test("pendências não listam vídeo", () => {
  const alerts = buildDashboardAlerts({
    ...empty,
    withoutPhotos: [{ id: "p1", brand: "VW", model: "Gol" }],
    staleVehicles: [{ id: "s1", brand: "Fiat", model: "Uno", days: 90 }],
    noFeatured: true,
  });
  assert.equal(
    alerts.some((alert) => /vídeo/i.test(`${alert.title} ${alert.description}`)),
    false,
  );
  assert.deepEqual(
    alerts.map((alert) => alert.key),
    ["no-photo-p1", "no-featured", "stale-s1"],
  );
});

test("celular mostra as primeiras pendências e guarda o resto", () => {
  const list = Array.from({ length: 7 }, (_, index) => index);
  const { head, rest } = splitDashboardAlerts(list);
  assert.equal(head.length, DASHBOARD_ALERTS_VISIBLE);
  assert.deepEqual(rest, [4, 5, 6]);
  assert.deepEqual(splitDashboardAlerts([1, 2], 4), { head: [1, 2], rest: [] });
});
