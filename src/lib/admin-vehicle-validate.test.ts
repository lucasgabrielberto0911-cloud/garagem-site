import assert from "node:assert/strict";
import { test } from "node:test";
import {
  kmHint,
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
