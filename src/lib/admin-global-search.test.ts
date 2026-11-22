import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeAdminSearch,
  vehicleGlobalWhere,
} from "./admin-global-search";

test("normalizeAdminSearch limpa espaços extras e limita a 120 caracteres", () => {
  assert.equal(normalizeAdminSearch(null), "");
  assert.equal(normalizeAdminSearch("   Honda   Civic  "), "Honda Civic");
  assert.equal(normalizeAdminSearch("a".repeat(150)).length, 120);
});

test("vehicleGlobalWhere escapa curingas barra, % e _ na busca literal", () => {
  const query = String.raw`100% _teste\x`;
  const where = vehicleGlobalWhere(query);
  assert.equal(where.historical, false);
  const clauses = where.AND as Array<{
    OR: Array<Record<string, { contains: string; mode: string }>>;
  }>;
  assert.equal(clauses.length, 2);
  assert.equal(clauses[0].OR[0].brand.contains, String.raw`100\%`);
  assert.equal(clauses[0].OR[3].plate.contains, "100");
  assert.equal(
    clauses[1].OR[0].brand.contains,
    String.raw`\_teste` + "\\" + "\\" + "x",
  );
  assert.equal(clauses[1].OR[3].plate.contains, "testex");
});
