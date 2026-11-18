import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  QUICK_PRICE_MAX,
  SIMPLE_SOLD_LABEL,
  parseQuickPrice,
  quickPriceError,
} from "./admin-quick-price";

const readSrc = (path: string) =>
  readFileSync(join(process.cwd(), "src", path), "utf8");

test("edição rápida aceita preço à vista em formato brasileiro", () => {
  assert.equal(parseQuickPrice("45.900,00"), 45900);
  assert.equal(parseQuickPrice("45900"), 45900);
  assert.equal(parseQuickPrice("R$ 45.900"), 45900);
  assert.equal(parseQuickPrice("89900,50"), 89900.5);
});

test("edição rápida recusa valor vazio, zero ou acima do teto", () => {
  assert.equal(parseQuickPrice(""), null);
  assert.equal(parseQuickPrice("abc"), null);
  assert.equal(parseQuickPrice("0"), null);
  assert.equal(parseQuickPrice("-100"), null);
  assert.equal(parseQuickPrice(String(QUICK_PRICE_MAX + 1)), null);
});

test("erro perto do campo usa português simples com exemplo", () => {
  assert.match(
    quickPriceError({ raw: "", status: "disponivel" }) ?? "",
    /preço à vista/i,
  );
  assert.match(
    quickPriceError({ raw: "abc", status: "disponivel" }) ?? "",
    /45\.900,00/,
  );
  assert.equal(
    quickPriceError({ raw: "45.900,00", status: "disponivel" }),
    null,
  );
});

test("vendido não muda de preço", () => {
  assert.match(
    quickPriceError({ raw: "45.900,00", status: "vendido" }) ?? "",
    /vendido/i,
  );
});

test("disponível trava quando a descrição cita outro valor", () => {
  const error = quickPriceError({
    raw: "89.900",
    status: "disponivel",
    description: "Anúncio antigo: R$ 92.000 à vista.",
  });
  assert.match(error ?? "", /92\.000/);
  assert.equal(
    quickPriceError({
      raw: "89.900",
      status: "reservado",
      description: "Anúncio antigo: R$ 92.000 à vista.",
    }),
    null,
  );
});

test("rótulo de venda simples é neutro (sem 'vendida')", () => {
  assert.equal(SIMPLE_SOLD_LABEL, "Marcar como vendido");
  assert.doesNotMatch(SIMPLE_SOLD_LABEL, /vendida/);
});

test("lista do admin usa o rótulo neutro e salva preço com revalidação", () => {
  const table = readSrc("components/admin/VehiclesTable.tsx");
  assert.doesNotMatch(table, /Marcar como vendida/);
  assert.match(table, /Marcar como vendido/);
  assert.match(table, /Preço à vista/);
  assert.match(table, /Alterar preço/);
  assert.doesNotMatch(table, /parcela/i);
  const actions = readSrc("app/admin/veiculos/actions.ts");
  const slice = actions.slice(
    actions.indexOf("export async function setVehiclePrice"),
  );
  assert.match(slice, /parseMoneyBR/);
  assert.match(slice, /recordVehiclePriceChange/);
  assert.match(slice, /await revalidatePublicStock\(/);
});
