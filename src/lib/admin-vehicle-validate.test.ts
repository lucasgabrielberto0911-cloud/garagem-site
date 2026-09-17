import assert from "node:assert/strict";
import { test } from "node:test";
import {
  descriptionPriceMismatch,
  extractCitedPrices,
  kmHint,
  parseBrCurrencyToken,
  validateVehicleListing,
  vehicleListingError,
} from "./admin-vehicle-validate";

const ok = {
  brand: "Fiat",
  model: "Pulse",
  fuel: "Flex",
  transmission: "Automático",
  color: "Cinza",
  km: 32000,
  price: 89900,
};

test("ficha exige câmbio e cor — Pulse sem cor não passa", () => {
  assert.equal(validateVehicleListing(ok).length, 0);
  const missingColor = validateVehicleListing({ ...ok, color: "  " });
  assert.equal(missingColor.some((issue) => issue.field === "color"), true);
  assert.match(vehicleListingError({ ...ok, color: null }) ?? "", /cor/);
  const missingGear = validateVehicleListing({ ...ok, transmission: "" });
  assert.equal(missingGear.some((issue) => issue.field === "transmission"), true);
});

test("preço e km fora da faixa são recusados", () => {
  assert.match(vehicleListingError({ ...ok, price: 0 }) ?? "", /preço/i);
  assert.match(vehicleListingError({ ...ok, price: 20_000_000 }) ?? "", /teto/);
  assert.match(vehicleListingError({ ...ok, km: -1 }) ?? "", /KM/);
  assert.match(vehicleListingError({ ...ok, km: 1_500_000 }) ?? "", /KM/);
  assert.match(kmHint(0) ?? "", /zero km/);
  assert.match(kmHint(450_000) ?? "", /alto/);
  assert.equal(kmHint(32000), null);
});

test("parseia preço BR com ponto de milhar e centavos", () => {
  assert.equal(parseBrCurrencyToken("89.900"), 89900);
  assert.equal(parseBrCurrencyToken("R$ 89.900,00"), 89900);
  assert.equal(parseBrCurrencyToken("89900"), 89900);
});

test("descrição extrai R$ e mil, e ignora KM e ano", () => {
  const cited = extractCitedPrices(
    "HB20 2018 com 32.000 km. Anunciado por R$ 85.000 — era 90 mil.",
  );
  assert.deepEqual(
    cited.map((item) => item.amount).sort((a, b) => a - b),
    [85000, 90000],
  );
  assert.equal(
    extractCitedPrices("Único dono, 45.000 km, revisões em dia.").length,
    0,
  );
});

test("aviso quando o texto cita preço diferente do campo", () => {
  assert.equal(
    descriptionPriceMismatch("Carro revisado, R$ 89.900, pronto.", 89900),
    null,
  );
  assert.equal(descriptionPriceMismatch("Bom estado, 89 mil.", 89900), null);
  const mismatch = descriptionPriceMismatch(
    "Anúncio antigo: R$ 92.000 à vista.",
    89900,
  );
  assert.ok(mismatch);
  assert.deepEqual(mismatch?.citedPrices, [92000]);
  assert.match(mismatch?.message ?? "", /R\$\s*92\.000/);
  assert.match(mismatch?.message ?? "", /R\$\s*89\.900/);
  assert.equal(descriptionPriceMismatch("", 89900), null);
  assert.equal(descriptionPriceMismatch("R$ 92.000", 0), null);
});

test("cidade física exige Serra ou Linhares quando o campo vem no form", () => {
  assert.equal(validateVehicleListing(ok).length, 0);
  assert.equal(
    validateVehicleListing({ ...ok, locationCity: "linhares" }).length,
    0,
  );
  assert.equal(
    validateVehicleListing({ ...ok, locationCity: "serra" }).length,
    0,
  );
  const missing = validateVehicleListing({ ...ok, locationCity: "  " });
  assert.equal(missing.some((issue) => issue.field === "locationCity"), true);
  assert.match(
    vehicleListingError({ ...ok, locationCity: "vitoria" }) ?? "",
    /Serra ou Linhares/,
  );
});
