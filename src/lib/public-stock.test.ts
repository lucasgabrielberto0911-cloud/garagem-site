import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PUBLIC_SITEMAP_VEHICLE_WHERE,
  isPublicStockVehicle,
} from "./public-stock";
import { isRetiredStockSlug, retiredRedirectSources } from "./retired-listings";

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
