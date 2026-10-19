import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeTrafficCounts, parseSiteFunnel } from "./site-funnel";
test("eventos só aceitam tipos, origens fechadas e ids válidos", () => {
  assert.equal(parseSiteFunnel({ event: "venda", origin: "google" }), null);
  assert.equal(parseSiteFunnel({ event: "visita", origin: "https://dados-pessoais" }), null);
  assert.equal(parseSiteFunnel({ event: "visita", origin: "google", vehicleId: "qualquer" }), null);
  assert.equal(parseSiteFunnel(null), null);
  assert.deepEqual(parseSiteFunnel({ event: "visita", origin: "google" }), { event: "visita", origin: "google", vehicleId: undefined });
});
test("junção mantém eventos sem leads e leads sem eventos, sem presumir conversão", () => {
  const rows = mergeTrafficCounts([{ key: "a", label: "A", acessos: 12, cliques: 0 }, { key: "b", label: "B", acessos: 2, cliques: 1 }], [
    { key: "b", label: "B", conversas: 1, marcadas: 0, visitas: 0, vendas: 1 },
    { key: "c", label: "C", conversas: 1, marcadas: 1, visitas: 1, vendas: 0 },
  ]);
  assert.equal(rows[0].key, "a"); assert.equal(rows[0].conversas, 0);
  assert.equal(rows.find(row => row.key === "b")?.vendas, 1);
  assert.equal(rows.find(row => row.key === "c")?.cliques, 0);
});
