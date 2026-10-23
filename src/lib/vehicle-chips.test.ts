import assert from "node:assert/strict";
import { test } from "node:test";
import { getVehicleYearChip, getVehicleDisplacementChip } from "./vehicle-chips";

test("getVehicleYearChip extrai ano do modelo ou fabricação", () => {
  assert.equal(getVehicleYearChip({ yearModel: 2023 }), "2023");
  assert.equal(getVehicleYearChip({ year: 2022, yearModel: 2023 }), "2023");
  assert.equal(getVehicleYearChip({ year: 2021 }), "2021");
  assert.equal(getVehicleYearChip({ yearModel: 0 }), null);
  assert.equal(getVehicleYearChip({}), null);
});

test("getVehicleDisplacementChip extrai cilindrada de moto em cc", () => {
  assert.equal(
    getVehicleDisplacementChip({ category: "moto", engineDisplacement: 300 }),
    "300cc"
  );
  assert.equal(
    getVehicleDisplacementChip({ category: "moto", cilindrada: 160 }),
    "160cc"
  );
  assert.equal(
    getVehicleDisplacementChip({ category: "moto", engine: "300cc" }),
    "300cc"
  );
  assert.equal(
    getVehicleDisplacementChip({ category: "moto", model: "XRE 300", version: "ABS" }),
    "300cc"
  );
  assert.equal(
    getVehicleDisplacementChip({ category: "moto", model: "BIZ 125", version: "ES" }),
    "125cc"
  );
});

test("getVehicleDisplacementChip extrai litragem de carro", () => {
  assert.equal(
    getVehicleDisplacementChip({ category: "carro", engine: "2.0 TSI" }),
    "2.0"
  );
  assert.equal(
    getVehicleDisplacementChip({ category: "carro", engine: "1.6 Flex" }),
    "1.6"
  );
  assert.equal(
    getVehicleDisplacementChip({ category: "carro", engineDisplacement: 2.0 }),
    "2.0"
  );
});

test("veículo vendido preserva specs e chips", () => {
  assert.equal(
    getVehicleYearChip({ yearModel: 2023 }),
    "2023"
  );
  assert.equal(
    getVehicleDisplacementChip({ category: "moto", engineDisplacement: 300 }),
    "300cc"
  );
});
