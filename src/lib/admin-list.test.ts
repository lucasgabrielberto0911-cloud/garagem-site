import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DELETE_CONFIRM_PHRASE,
  adminListScanLine,
  deleteRequiresTypedConfirm,
} from "./admin-list";

test("linha do lote junta ano, km, câmbio, cor e placa", () => {
  assert.equal(
    adminListScanLine({
      year: 2017,
      yearModel: 2018,
      km: 45200,
      transmission: "automatico",
      color: "prata",
      plate: "ABC1D23",
    }),
    "2017/2018 · 45.200 km · Automático · Prata · ABC1D23",
  );
  assert.equal(
    adminListScanLine({
      year: 2020,
      yearModel: 2020,
      km: 1000,
    }),
    "2020/2020 · 1.000 km",
  );
});

test("excluir com foto ou já vendido pede digitação", () => {
  assert.equal(deleteRequiresTypedConfirm({ photoCount: 0, status: "disponivel" }), false);
  assert.equal(deleteRequiresTypedConfirm({ photoCount: 3, status: "disponivel" }), true);
  assert.equal(deleteRequiresTypedConfirm({ photoCount: 0, status: "vendido" }), true);
  assert.equal(DELETE_CONFIRM_PHRASE, "EXCLUIR");
});
