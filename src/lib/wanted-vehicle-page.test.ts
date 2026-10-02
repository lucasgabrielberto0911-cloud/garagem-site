import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WANTED_VEHICLE_BUTTON_LABEL,
  wantedVehicleFormCopy,
  wantedVehicleHref,
  wantedVehicleReturnTo,
} from "@/lib/wanted-vehicle-page";

test("o botão do estoque usa o texto combinado", () => {
  assert.equal(WANTED_VEHICLE_BUTTON_LABEL, "Não achou seu próximo veículo?");
});

test("sem filtro o pedido abre limpo; com filtro leva ano, preço e o vazio", () => {
  assert.equal(wantedVehicleHref({}), "/pedido");
  assert.equal(
    wantedVehicleHref(
      { q: " Corolla ", minYear: "2019", maxKm: "60000", brand: "Toyota" },
      { empty: true },
    ),
    "/pedido?q=Corolla&brand=Toyota&minYear=2019&maxKm=60000&sem=1",
  );
});

test("a página do pedido reaproveita o modelo e devolve o caminho do estoque", () => {
  const copy = wantedVehicleFormCopy({
    q: "HB20",
    minPrice: "40000",
    maxPrice: "60000",
    sem: "1",
  });
  assert.equal(copy.initialModel, "HB20");
  assert.equal(copy.initialPriceMin, "40000");
  assert.equal(copy.initialPriceMax, "60000");
  assert.equal(copy.initialKmMax, "");
  assert.equal(copy.pagePath, "/estoque?q=HB20&minPrice=40000&maxPrice=60000");
  assert.equal(wantedVehicleReturnTo({ sem: "1" }), "/estoque");
  assert.match(copy.contextLabel, /HB20/);
  assert.match(copy.description, /Não tem HB20 agora/);
  assert.doesNotMatch(copy.pagePath, /sem=/);
});

test("pedido com carros na lista usa o texto de quem não achou na grade", () => {
  const copy = wantedVehicleFormCopy({ model: "Civic" });
  assert.equal(copy.initialModel, "Civic");
  assert.match(copy.description, /Se o modelo não está na lista/);
  assert.equal(copy.pagePath, "/estoque?model=Civic");
});
