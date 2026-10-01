import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { cityPageStockCopy } from "./city-showcase";

const CITIES = [
  ["colatina", "Colatina"],
  ["serra", "Serra"],
  ["aracruz", "Aracruz"],
  ["linhares", "Linhares"],
  ["vitoria", "Vitória"],
] as const;

test("toda landing descreve o estoque inteiro, sem recorte por cidade", () => {
  const hrefs = new Set<string>();
  const headings = new Set<string>();
  for (const [, name] of CITIES) {
    const copy = cityPageStockCopy(name);
    hrefs.add(copy.stockHref);
    headings.add(copy.heading);
    assert.equal(copy.stockHref, "/estoque");
    assert.equal(copy.stockLabel, "Ver o estoque");
    assert.match(copy.intro, /mesma do estoque/i);
    assert.match(copy.intro, /ficha/i);
    assert.match(copy.intro, new RegExp(name));
    assert.match(copy.whatsappMessage, /vídeo/i);
    assert.match(copy.whatsappMessage, /visita/i);
    assert.match(copy.whatsappMessage, new RegExp(name));
    assert.match(copy.empty, /não tem veículo disponível/i);
    assert.doesNotMatch(copy.intro, /só entram|não entram nesta lista|maior parte do estoque está em Linhares/i);
    assert.doesNotMatch(copy.stockHref, /city=/);
    assert.doesNotMatch(copy.empty, /Linhares|Serra|Aracruz/);
    assert.doesNotMatch(`${copy.intro} ${copy.empty}`, /Mobi|Palio|Civic|Biz/);
  }
  assert.equal(hrefs.size, 1);
  assert.equal(headings.size, 1);
});

test("a página e a consulta trazem o estoque disponível inteiro", () => {
  const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const page = readFileSync(
    join(srcRoot, "app/(site)/seminovos/[cidade]/page.tsx"),
    "utf8",
  );
  const vehicles = readFileSync(join(srcRoot, "lib/vehicles.ts"), "utf8");
  assert.match(page, /getCityShowcaseVehicles\(\)/);
  assert.match(page, /const featured = await getCityShowcaseVehicles\(\)/);
  assert.match(page, /vehicles=\{featured\}/);
  assert.match(page, /cityPageStockCopy/);
  assert.match(page, /showWhatsApp=\{false\}/);
  assert.match(page, /Pedir vídeo ou visita/);
  assert.match(page, /stock\.stockHref/);
  assert.doesNotMatch(page, /^["']use client["']/m);
  assert.doesNotMatch(page, /useSearchParams|EstoqueBrowse|\/api\/estoque|VehicleCardSkeleton/);
  assert.doesNotMatch(page, /searchParams/);
  assert.doesNotMatch(page, /city=serra|city=linhares|linkSerra|linkLinhares/);
  assert.doesNotMatch(page, /estão em \$\{city\.name\}/);

  const showcase = vehicles.slice(
    vehicles.indexOf("async function fetchCityShowcaseVehicles"),
    vehicles.indexOf("const loadCityShowcaseCached"),
  );
  assert.match(showcase, /status: "disponivel"/);
  assert.match(showcase, /createdAt: "desc"/);
  assert.doesNotMatch(showcase, /locationCity|cityShowcaseStockCity|stockCityFilter|pickCityShowcase|take:/);
  assert.doesNotMatch(showcase, /consigned|Consignado/);
});
