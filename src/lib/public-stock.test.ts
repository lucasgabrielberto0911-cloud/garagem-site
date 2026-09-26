import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PUBLIC_SITEMAP_VEHICLE_WHERE,
  PUBLIC_VEHICLE_CARD_SELECT,
  isPublicStockVehicle,
} from "./public-stock";
import { isRetiredStockSlug, retiredRedirectSources } from "./retired-listings";
import { CHAT_VEHICLE_SELECT } from "./chat-stock";
import { PUBLIC_VEHICLE_DETAIL_SELECT, PUBLIC_VEHICLE_OMIT } from "./vehicles";

test("card público traz miniatura sem campos de admin", () => {
  assert.equal(PUBLIC_VEHICLE_CARD_SELECT.photos.select.thumbnailUrl, true);
  assert.equal("plate" in PUBLIC_VEHICLE_CARD_SELECT, false);
  assert.equal("fipePrice" in PUBLIC_VEHICLE_CARD_SELECT, false);
  assert.equal("purchasePrice" in PUBLIC_VEHICLE_CARD_SELECT, false);
});

test("nenhum select público carrega campo interno (consignado, compra, placa, FIPE)", () => {
  const publicSelects = {
    card: PUBLIC_VEHICLE_CARD_SELECT,
    ficha: PUBLIC_VEHICLE_DETAIL_SELECT,
    chat: CHAT_VEHICLE_SELECT,
  };
  for (const [name, select] of Object.entries(publicSelects)) {
    for (const field of Object.keys(PUBLIC_VEHICLE_OMIT)) {
      assert.equal(field in select, false, `${name} expõe ${field}`);
    }
  }
  assert.equal(PUBLIC_VEHICLE_OMIT.consigned, true);
  assert.equal(PUBLIC_VEHICLE_OMIT.fipePrice, true);
  assert.equal(PUBLIC_VEHICLE_OMIT.plate, true);
  assert.equal(PUBLIC_VEHICLE_OMIT.purchasePrice, true);
  assert.equal(PUBLIC_VEHICLE_OMIT.inStoreName, true);
});

test("ficha pública inclui chave, manual e vídeo e esconde documentos", () => {
  assert.equal(PUBLIC_VEHICLE_DETAIL_SELECT.hasSpareKey, true);
  assert.equal(PUBLIC_VEHICLE_DETAIL_SELECT.hasManual, true);
  assert.equal(PUBLIC_VEHICLE_DETAIL_SELECT.hasVideo, true);
  assert.equal("hasSpareKey" in PUBLIC_VEHICLE_OMIT, false);
  assert.equal("hasManual" in PUBLIC_VEHICLE_OMIT, false);

  for (const field of [
    "documents",
    "costs",
    "sale",
    "fipePrice",
    "plate",
    "purchasePrice",
    "inStoreName",
    "consigned",
  ]) {
    assert.equal(field in PUBLIC_VEHICLE_DETAIL_SELECT, false, `ficha expõe ${field}`);
  }

  assert.equal("hasSpareKey" in PUBLIC_VEHICLE_CARD_SELECT, false);
  assert.equal("hasManual" in PUBLIC_VEHICLE_CARD_SELECT, false);
  assert.equal("hasVideo" in PUBLIC_VEHICLE_CARD_SELECT, false);
  assert.equal("hasSpareKey" in CHAT_VEHICLE_SELECT, false);
  assert.equal("hasManual" in CHAT_VEHICLE_SELECT, false);
  assert.equal("hasVideo" in CHAT_VEHICLE_SELECT, false);
  assert.equal("documents" in CHAT_VEHICLE_SELECT, false);
});

test("sitemap só inclui estoque disponível e não histórico", () => {
  assert.equal(PUBLIC_SITEMAP_VEHICLE_WHERE.status, "disponivel");
  assert.equal(PUBLIC_SITEMAP_VEHICLE_WHERE.historical, false);
  assert.equal(isPublicStockVehicle({ status: "disponivel", historical: false }), true);
  assert.equal(isPublicStockVehicle({ status: "reservado", historical: false }), false);
  assert.equal(isPublicStockVehicle({ status: "vendido", historical: false }), false);
  assert.equal(isPublicStockVehicle({ status: "disponivel", historical: true }), false);
  assert.equal(isPublicStockVehicle({ status: "disponivel" }), true);
});

test("Etios 404 entra na lista de anúncios aposentados", () => {
  assert.equal(
    isRetiredStockSlug(
      "toyota-etios-xs-xs-1-5-16v-flex-automatico-2017-cmturwtw30000l804s8700mu4",
    ),
    true,
  );
  assert.equal(isRetiredStockSlug("cmturwtw30000l804s8700mu4"), true);
  assert.equal(
    isRetiredStockSlug("honda-hr-v-ex-1-8-flex-one-automatico-2018-cmtbv7xso0000l50429oklxxy"),
    false,
  );
  assert.ok(
    retiredRedirectSources().includes(
      "/estoque/toyota-etios-xs-xs-1-5-16v-flex-automatico-2017-cmturwtw30000l804s8700mu4",
    ),
  );
});
