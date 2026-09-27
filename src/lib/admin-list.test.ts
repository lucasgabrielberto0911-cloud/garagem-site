import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_CARD_OVERFLOW_ACTIONS,
  DELETE_CONFIRM_PHRASE,
  adminCardMetaLine,
  adminCardOverflowStatuses,
  adminCardShowsSoldAction,
  deleteRequiresTypedConfirm,
} from "./admin-list";

test("card da lista: ano, km, câmbio e cidade numa linha", () => {
  assert.equal(
    adminCardMetaLine({
      year: 2015,
      yearModel: 2016,
      km: 103000,
      transmission: "automatico",
      locationCity: "linhares",
    }),
    "2015/2016 · 103.000 km · Automático · Linhares",
  );
  assert.equal(
    adminCardMetaLine({
      year: 2014,
      yearModel: 2015,
      km: 106000,
      transmission: "Automático",
      locationCity: "serra",
    }),
    "2014/2015 · 106.000 km · Automático · Serra",
  );
  assert.equal(
    adminCardMetaLine({
      year: 2020,
      yearModel: 2020,
      km: 1000,
      transmission: "",
      locationCity: "vitoria",
    }),
    "2020/2020 · 1.000 km",
  );
});

test("venda fica no card; reservar e voltar ficam no menu", () => {
  assert.equal(adminCardShowsSoldAction("disponivel"), true);
  assert.equal(adminCardShowsSoldAction("reservado"), true);
  assert.equal(adminCardShowsSoldAction("vendido"), false);
  assert.deepEqual(
    adminCardOverflowStatuses("disponivel").map((item) => item.value),
    ["reservado"],
  );
  assert.deepEqual(
    adminCardOverflowStatuses("reservado").map((item) => item.label),
    ["Voltar para disponível"],
  );
  assert.deepEqual(
    adminCardOverflowStatuses("vendido").map((item) => item.value),
    ["disponivel", "reservado"],
  );
  assert.deepEqual(
    [...ADMIN_CARD_OVERFLOW_ACTIONS],
    ["operacao", "site", "destacar", "duplicar", "excluir"],
  );
});

test("excluir com foto ou já vendido pede digitação", () => {
  assert.equal(deleteRequiresTypedConfirm({ photoCount: 0, status: "disponivel" }), false);
  assert.equal(deleteRequiresTypedConfirm({ photoCount: 3, status: "disponivel" }), true);
  assert.equal(deleteRequiresTypedConfirm({ photoCount: 0, status: "vendido" }), true);
  assert.equal(DELETE_CONFIRM_PHRASE, "EXCLUIR");
});
