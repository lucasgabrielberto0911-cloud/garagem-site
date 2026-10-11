import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAdminPage, parseAdminPageSize } from "./admin-page-param";

test("parseAdminPage: valores válidos e conversões normais", () => {
  assert.equal(parseAdminPage("1"), 1);
  assert.equal(parseAdminPage("2"), 2);
  assert.equal(parseAdminPage(" 10 "), 10);
  assert.equal(parseAdminPage(5), 5);
  assert.equal(parseAdminPage("007"), 7);
  assert.equal(parseAdminPage("1e2"), 100);
});

test("parseAdminPage: decimais são truncados", () => {
  assert.equal(parseAdminPage("2.9"), 2);
  assert.equal(parseAdminPage("3.1"), 3);
  assert.equal(parseAdminPage(5.8), 5);
  // Decimal menor que 1 vira 0 e cai no default 1
  assert.equal(parseAdminPage("0.9"), 1);
  assert.equal(parseAdminPage(0.5), 1);
});

test("parseAdminPage: valores inválidos, zero, negativos, NaN e Infinity usam default 1", () => {
  assert.equal(parseAdminPage(undefined), 1);
  assert.equal(parseAdminPage(null), 1);
  assert.equal(parseAdminPage(""), 1);
  assert.equal(parseAdminPage("   "), 1);
  assert.equal(parseAdminPage("abc"), 1);
  assert.equal(parseAdminPage("0"), 1);
  assert.equal(parseAdminPage(0), 1);
  assert.equal(parseAdminPage("-5"), 1);
  assert.equal(parseAdminPage(-10), 1);
  assert.equal(parseAdminPage("NaN"), 1);
  assert.equal(parseAdminPage(NaN), 1);
  assert.equal(parseAdminPage("Infinity"), 1);
  assert.equal(parseAdminPage(Infinity), 1);
  assert.equal(parseAdminPage("-Infinity"), 1);
  assert.equal(parseAdminPage(-Infinity), 1);
  assert.equal(parseAdminPage({}), 1);
  assert.equal(parseAdminPage(true), 1);
  assert.equal(parseAdminPage(false), 1);
});

test("parseAdminPage: array usa apenas o primeiro elemento", () => {
  assert.equal(parseAdminPage(["3", "10"]), 3);
  assert.equal(parseAdminPage(["2"]), 2);
  assert.equal(parseAdminPage([]), 1);
  assert.equal(parseAdminPage([""]), 1);
  assert.equal(parseAdminPage(["abc"]), 1);
  assert.equal(parseAdminPage(["-4"]), 1);
});

test("parseAdminPage: teto opcional limita o número máximo", () => {
  assert.equal(parseAdminPage("50", 10), 10);
  assert.equal(parseAdminPage("5", 10), 5);
  assert.equal(parseAdminPage("100", 50), 50);
});

test("parseAdminPageSize: números válidos respeitam o limite", () => {
  assert.equal(parseAdminPageSize("20", 10, 50), 20);
  assert.equal(parseAdminPageSize(15, 10, 50), 15);
  assert.equal(parseAdminPageSize(" 40 ", 10, 50), 40);
});

test("parseAdminPageSize: trunca decimais", () => {
  assert.equal(parseAdminPageSize("25.9", 20, 100), 25);
  assert.equal(parseAdminPageSize(35.2, 20, 100), 35);
  // Menor que 1 trunca para 0 e aplica fallback
  assert.equal(parseAdminPageSize("0.9", 20, 100), 20);
});

test("parseAdminPageSize: aplica teto (max)", () => {
  assert.equal(parseAdminPageSize("200", 20, 100), 100);
  assert.equal(parseAdminPageSize(1000, 20, 50), 50);
  assert.equal(parseAdminPageSize("500", 10, 40), 40);
});

test("parseAdminPageSize: entradas inválidas, vazias, zero e negativas usam fallback", () => {
  assert.equal(parseAdminPageSize(undefined, 20, 100), 20);
  assert.equal(parseAdminPageSize(null, 20, 100), 20);
  assert.equal(parseAdminPageSize("", 20, 100), 20);
  assert.equal(parseAdminPageSize("   ", 20, 100), 20);
  assert.equal(parseAdminPageSize("0", 20, 100), 20);
  assert.equal(parseAdminPageSize(0, 20, 100), 20);
  assert.equal(parseAdminPageSize("-10", 20, 100), 20);
  assert.equal(parseAdminPageSize(-5, 20, 100), 20);
  assert.equal(parseAdminPageSize("abc", 20, 100), 20);
  assert.equal(parseAdminPageSize("15px", 20, 100), 20);
  assert.equal(parseAdminPageSize(NaN, 20, 100), 20);
  assert.equal(parseAdminPageSize("NaN", 20, 100), 20);
  assert.equal(parseAdminPageSize(Infinity, 20, 100), 20);
  assert.equal(parseAdminPageSize("Infinity", 20, 100), 20);
  assert.equal(parseAdminPageSize("-Infinity", 20, 100), 20);
  assert.equal(parseAdminPageSize({}, 20, 100), 20);
  assert.equal(parseAdminPageSize(false, 20, 100), 20);
});

test("parseAdminPageSize: array usa o primeiro elemento", () => {
  assert.equal(parseAdminPageSize(["30", "50"], 20, 100), 30);
  assert.equal(parseAdminPageSize(["200"], 20, 100), 100);
  assert.equal(parseAdminPageSize([], 20, 100), 20);
  assert.equal(parseAdminPageSize([""], 20, 100), 20);
  assert.equal(parseAdminPageSize(["invalid"], 20, 100), 20);
});

test("parseAdminPageSize: fallback superior ao max é contido no max", () => {
  assert.equal(parseAdminPageSize("invalid", 150, 100), 100);
  assert.equal(parseAdminPageSize("invalid", 0, 100), 1);
});
