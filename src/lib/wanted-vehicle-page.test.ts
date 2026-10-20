import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  WANTED_BUDGET_OPTIONS,
  WANTED_VEHICLE_BUTTON_LABEL,
  wantedBudgetToQuery,
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

test("voltar e o formulário ficam no meio, fora do balão", () => {
  const page = readFileSync("src/app/(site)/pedido/page.tsx", "utf8");
  const css = readFileSync("src/app/globals.css", "utf8");
  const backAt = page.indexOf("Voltar ao estoque");
  const formAt = page.indexOf("<MissingModelForm");
  const sheetAt = page.indexOf('className="wanted-vehicle-sheet"');
  assert.ok(sheetAt > 0 && sheetAt < backAt && backAt < formAt);
  assert.match(css, /\.wanted-vehicle-sheet\s*\{[^}]*margin-inline:\s*auto/);
  assert.match(css, /calc\(100% - 2 \* var\(--wanted-side-clear\)\)/);
  assert.match(
    css,
    /var\(--site-bottom-nav\)\s*\+\s*var\(--help-bubble-gap\)\s*\+\s*var\(--help-bubble-h\)\s*\+\s*2rem/,
  );
  assert.doesNotMatch(
    css,
    /body:has\(\[data-wanted-vehicle-page\]\)\s*\{[^}]*overflow:\s*hidden/,
  );
  assert.doesNotMatch(css, /\.wanted-vehicle-page\s*\{[^}]*padding-right/);
  assert.match(
    css,
    /body:has\(\[data-wanted-vehicle-page\]\) \.site-chat:not\(\.is-open\) \.site-chat-launcher \{[^}]*width:\s*3\.5rem/,
  );
});

test("pedido com carros na lista usa o texto de quem não achou na grade", () => {
  const copy = wantedVehicleFormCopy({ model: "Civic" });
  assert.equal(copy.initialModel, "Civic");
  assert.match(copy.description, /Se o modelo não está na lista/);
  assert.equal(copy.pagePath, "/estoque?model=Civic");
});

test("WantedVehicleCta converte faixa em query de /pedido e usa link wa.me real; ficha vendida pré-preenche modelo sem preço", () => {
  assert.equal(WANTED_BUDGET_OPTIONS.length, 4);
  assert.deepEqual(wantedBudgetToQuery("Até R$ 50 mil"), { maxPrice: "50000" });
  assert.deepEqual(wantedBudgetToQuery("R$ 50 mil a R$ 80 mil"), {
    minPrice: "50000",
    maxPrice: "80000",
  });
  assert.deepEqual(wantedBudgetToQuery("R$ 80 mil a R$ 120 mil"), {
    minPrice: "80000",
    maxPrice: "120000",
  });
  assert.deepEqual(wantedBudgetToQuery("Acima de R$ 120 mil"), { minPrice: "120000" });
  assert.deepEqual(wantedBudgetToQuery(""), {});
  assert.equal(
    wantedVehicleHref({ q: "Corolla", ...wantedBudgetToQuery("R$ 50 mil a R$ 80 mil") }),
    "/pedido?q=Corolla&minPrice=50000&maxPrice=80000",
  );

  const cta = readFileSync("src/components/site/WantedVehicleCta.tsx", "utf8");
  const ficha = readFileSync("src/app/(vehicle)/estoque/[id]/page.tsx", "utf8");
  assert.doesNotMatch(cta, /window\.open/);
  assert.match(cta, /href=\{href\}/);
  assert.match(cta, /Registrar pedido no site/);
  assert.match(ficha, /initialModel=\{sold \? title : ""\}/);
  assert.match(ficha, /Pedir parecido no WhatsApp/);
});
