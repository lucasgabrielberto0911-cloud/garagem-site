import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  formatPhoneBR,
  isValidBrazilPhone,
  normalizeBrazilPhoneDigits,
} from "./format";
import {
  limitSellPhotoSelection,
  MAX_SELL_PHOTO_BYTES,
  MAX_SELL_PHOTOS,
} from "./sell-photo-upload";
import {
  buildSellLeadIdempotencyKey,
  clearLeadRequestCacheForTests,
  findRememberedLeadRequest,
  rememberLeadRequest,
} from "./lead-venda";
import {
  filterValidIntents,
  isIntentExpired,
  OFFLINE_INTENT_TTL_MS,
  type OfflineIntent,
} from "./offline-queue";
import { attachQueryError } from "./vehicles";
import {
  RECENT_VEHICLES_CACHE_TTL_MS,
  shouldFetchRecentVehicles,
} from "./recently-viewed";
import { kmFilterOptions } from "../components/site/StockFilterControls";
import {
  GALLERY_HERO_SIZES,
  sanitizeFiltersForCategory,
  type StockModelOption,
} from "./stock-query";
import {
  accessoryFilterVariants,
  canonicalStockAccessoryLabel,
  sanitizeAccessory,
} from "./vehicle-accessories";
import { parseLegend } from "./legend-parser";
import { buildStockFacets } from "./stock-facets";
import { extractNaturalStockClauses, stockSearchWhere } from "./stock-search";
import {
  COMPARISON_SESSION_KEY,
  readComparisonSession,
} from "./favorites-comparison";
import { WORDMARK_SRC_SET } from "../components/site/SiteWordmark";

const root = process.cwd();
function readSrc(rel: string) {
  return readFileSync(join(root, "src", rel), "utf8");
}

test("Auditoria Site #14: validação e normalização de telefone BR (DDD, prefixo 55, celular com 9 e repetidos)", () => {
  assert.equal(normalizeBrazilPhoneDigits("+55 (27) 99633-0706"), "27996330706");
  assert.equal(formatPhoneBR("5527996330706"), "(27) 99633-0706");
  assert.equal(isValidBrazilPhone("(27) 99633-0706"), true);
  assert.equal(isValidBrazilPhone("+55 27 99633-0706"), true);
  assert.equal(isValidBrazilPhone("(27) 3371-2030"), true);
  assert.equal(isValidBrazilPhone("(00) 00000-0000"), false);
  assert.equal(isValidBrazilPhone("11111111111"), false);
  assert.equal(isValidBrazilPhone("(27) 89999-9999"), false);
  assert.equal(isValidBrazilPhone("996330706"), false);
});

test("Auditoria Site #15, #16, #17 e Fluxo #13: limite de fotos, prévias visuais, aviso de rascunho e bloqueio de tooltip nativo em inglês", () => {
  assert.equal(MAX_SELL_PHOTOS, 10);
  assert.equal(MAX_SELL_PHOTO_BYTES, 15 * 1024 * 1024);

  const selection = limitSellPhotoSelection(8, ["a", "b", "c", "d"], 10);
  assert.deepEqual(selection.accepted, ["a", "b"]);
  assert.equal(selection.ignoredCount, 2);

  const uploadSrc = readSrc("components/site/SellPhotoUpload.tsx");
  assert.match(uploadSrc, /createObjectURL/);
  assert.match(uploadSrc, /revokeObjectURL/);
  assert.match(uploadSrc, /Prévia da foto/);

  const sellFormSrc = readSrc("components/site/SellForm.tsx");
  assert.match(sellFormSrc, /beforeunload/);
  assert.match(sellFormSrc, /se recarregar a página, escolha as fotos novamente/);
  assert.match(sellFormSrc, /onInvalid=\{\(event\) => event\.preventDefault\(\)\}/);

  const missingModelSrc = readSrc("components/site/MissingModelForm.tsx");
  assert.match(missingModelSrc, /onInvalid=\{\(event\) => event\.preventDefault\(\)\}/);
});

test("Auditoria Site #18: chave de idempotência e deduplicação de lead de venda em retentativas", () => {
  clearLeadRequestCacheForTests();
  const reqKey = buildSellLeadIdempotencyKey({
    requestId: "q-12345678-abcdef",
    phone: "(27) 99633-0706",
    vehicleInfo: "Honda Civic 2020",
    plate: "ABC1D23",
  });
  assert.equal(reqKey, "req:q-12345678-abcdef");

  const sigKey = buildSellLeadIdempotencyKey({
    phone: "(27) 99633-0706",
    vehicleInfo: "  Honda   Civic 2020 ",
    plate: "abc1d23",
  });
  assert.equal(sigKey, "sig:27996330706:honda civic 2020:ABC1D23");

  const now = 1_700_000_000_000;
  rememberLeadRequest(reqKey, "lead-1", now, 60_000);
  assert.equal(findRememberedLeadRequest(reqKey, now + 10_000), "lead-1");
  assert.equal(findRememberedLeadRequest(reqKey, now + 61_000), null);
  clearLeadRequestCacheForTests();
});

test("Auditoria Site #19, #20, #21 e #22: TTL da fila offline, trava contra corrida, preservação em popup bloqueado e captura de erro de IDB", () => {
  const now = 1_700_000_000_000;
  const freshWhatsApp: OfflineIntent = {
    id: "q-1",
    type: "whatsapp",
    url: "https://wa.me/5527996330706",
    createdAt: now - 1000,
  };
  const expiredWhatsApp: OfflineIntent = {
    id: "q-2",
    type: "whatsapp",
    url: "https://wa.me/5527996330706",
    createdAt: now - OFFLINE_INTENT_TTL_MS.whatsapp - 1,
  };
  const freshSell: OfflineIntent = {
    id: "q-3",
    type: "sell",
    fields: { name: "Teste" },
    createdAt: now - OFFLINE_INTENT_TTL_MS.whatsapp - 1000,
  };

  assert.equal(isIntentExpired(freshWhatsApp, now), false);
  assert.equal(isIntentExpired(expiredWhatsApp, now), true);
  assert.equal(isIntentExpired(freshSell, now), false);

  const filtered = filterValidIntents([expiredWhatsApp, freshSell, freshWhatsApp], now);
  assert.deepEqual(
    filtered.valid.map((item) => item.id),
    ["q-3", "q-1"],
  );
  assert.deepEqual(filtered.expiredIds, ["q-2"]);

  const flushSrc = readSrc("components/site/OfflineLeadFlush.tsx");
  assert.match(flushSrc, /activeFlushPromise/);
  assert.match(flushSrc, /garagem-offline-flush/);
  assert.match(flushSrc, /claimIntent/);
  assert.match(flushSrc, /releaseIntentClaim/);
  const elseBranch = flushSrc.slice(flushSrc.indexOf("if (opened)"), flushSrc.indexOf("export async function flushQueue"));
  const beforeToast = elseBranch.slice(elseBranch.indexOf("} else {"), elseBranch.indexOf('notify("Há um recado'));
  assert.doesNotMatch(beforeToast, /deleteIntent\(first\.id\)/);
  assert.match(elseBranch.slice(elseBranch.indexOf('label: "Abrir"')), /deleteIntent\(first\.id\)/);
});

test("Auditoria Site #02, #03, #04 e Fluxo #12, #15: erro de banco na Home, alvos de 44px no HeroSearch, cache em Vistos Recentemente e CookieConsent após conteúdo", () => {
  const fallback = attachQueryError([] as string[], "Banco indisponível");
  assert.equal(Array.isArray(fallback), true);
  assert.equal(fallback.length, 0);
  assert.equal(fallback.error, "Banco indisponível");
  assert.deepEqual(Object.keys(fallback), []);

  const homeSrc = readSrc("app/(catalog)/page.tsx");
  assert.match(homeSrc, /featured\.error/);
  assert.match(homeSrc, /Não foi possível carregar os veículos em destaque agora/);

  const heroSearchSrc = readSrc("components/site/HeroSearch.tsx");
  assert.match(heroSearchSrc, /min-h-\[44px\]/);
  assert.match(heroSearchSrc, /via-asphalt\/90/);

  const now = 1_700_000_000_000;
  assert.equal(shouldFetchRecentVehicles(null, "id1", now), true);
  assert.equal(
    shouldFetchRecentVehicles({ key: "id1", failed: false, fetchedAt: now - 10_000 }, "id1", now),
    false,
  );
  assert.equal(
    shouldFetchRecentVehicles(
      { key: "id1", failed: false, fetchedAt: now - RECENT_VEHICLES_CACHE_TTL_MS - 1 },
      "id1",
      now,
    ),
    true,
  );
  assert.equal(
    shouldFetchRecentVehicles({ key: "id1", failed: true, fetchedAt: now - 1000 }, "id1", now),
    true,
  );

  const layoutSrc = readSrc("app/(site)/layout.tsx");
  const mainSlice = layoutSrc.slice(layoutSrc.indexOf("<main"), layoutSrc.indexOf("</main>"));
  assert.ok(mainSlice.indexOf("{children}") < mainSlice.indexOf("<CookieConsent />"));
});

test("Auditoria Site #05, #06, #07, #08, #09, #48: filtros de estoque, histórico desktop, km customizado, troca carro/moto e consulta por IDs", () => {
  const customKm = kmFilterOptions("35000");
  assert.ok(customKm.some((opt) => opt.value === "35000" && opt.label === "Até 35.000 km"));
  assert.equal(kmFilterOptions("50000").filter((opt) => opt.value === "50000").length, 1);

  const models: StockModelOption[] = [
    { brand: "Honda", model: "Civic", categories: ["carro"] },
    { brand: "Yamaha", model: "Fazer 250", categories: ["moto"] },
  ];
  const sanitizedMoto = sanitizeFiltersForCategory(
    {
      category: "carro",
      brand: "Honda",
      model: "Civic",
      fuel: "Diesel",
      accessory: "Teto solar,ABS",
    },
    "moto",
    models,
  );
  assert.equal(sanitizedMoto.category, "moto");
  assert.equal(sanitizedMoto.brand, "");
  assert.equal(sanitizedMoto.model, "");
  assert.equal(sanitizedMoto.fuel, "");
  assert.equal(sanitizedMoto.accessory, "ABS");

  const filtersSrc = readSrc("components/site/StockFilters.tsx");
  assert.match(filtersSrc, /draftCount\?\.key === draftKey \? draftCount\.total : null/);
  assert.match(filtersSrc, /options\?\.replace/);

  const browseSrc = readSrc("components/site/EstoqueBrowse.tsx");
  assert.match(browseSrc, /hasFetchedFilterResult/);

  const landingSrc = readSrc("components/site/StockLanding.tsx");
  assert.match(landingSrc, /getVehiclesByIds/);
});

test("Auditoria Fluxo #6, #7 e #8: truncamento de acessórios, deduplicação de facetas e busca natural/fonética", () => {
  assert.equal(sanitizeAccessory("Computador de bordo e GPS integ"), "Computador de bordo e GPS integrado");
  assert.equal(sanitizeAccessory("Consumo de combustíve reduzido"), "Consumo de combustível reduzido");
  const legend = parseLegend("Conforto:\n✅ Multimídia com GPS integ\n✅ Consumo de combustíve");
  assert.deepEqual(legend.accessories, [
    "Conforto: Multimídia com GPS integrado",
    "Conforto: Consumo de combustível",
  ]);

  assert.equal(canonicalStockAccessoryLabel("6 Air Bags"), "6 airbags");
  assert.equal(
    canonicalStockAccessoryLabel("Segurança: 6 airbags (frontais, laterais e de cortina)"),
    "6 airbags",
  );
  assert.equal(canonicalStockAccessoryLabel("Alarme antifurto"), "Alarme");
  assert.equal(canonicalStockAccessoryLabel("Alarme perimétrico"), "Alarme");
  assert.equal(canonicalStockAccessoryLabel("Piloto automático (cruise control)"), "Piloto automático");
  assert.equal(canonicalStockAccessoryLabel("Alerta de pressão dos pneus (iTPMS)"), "Sensor de pressão dos pneus (TPMS)");

  const facets = buildStockFacets([
    {
      category: "carro",
      brand: "Chevrolet",
      model: "Onix",
      transmission: "Automático",
      fuel: "Flex",
      color: "Branco",
      yearModel: 2023,
      accessories: ["6 Air Bags", "Segurança: 6 airbags (frontais, laterais e de cortina)", "Alarme antifurto", "Alarme"],
    },
  ]);
  assert.deepEqual(facets.accessories, ["6 airbags", "Alarme"]);
  assert.ok(accessoryFilterVariants("6 airbags").includes("6 Air Bags"));
  assert.ok(accessoryFilterVariants("6 airbags").includes("Segurança: 6 airbags (frontais, laterais e de cortina)"));

  const natural = extractNaturalStockClauses("Civic automático até 60 mil");
  assert.equal(natural.restQuery, "Civic");
  assert.equal(natural.clauses.length, 2);

  const catalog = [{ brand: "Chevrolet", model: "Onix", version: "LTZ" }];
  const onyxWhere = stockSearchWhere("onyx", catalog);
  const onyxModels = onyxWhere.flatMap((c) => c.OR ?? []).flatMap((r) =>
    typeof r.model === "object" && r.model && "in" in r.model ? (r.model as { in: string[] }).in : [],
  );
  assert.deepEqual(onyxModels, ["Onix"]);
});

test("Auditoria Site #10, #11, #12, #13 e Fluxo Melhoria #4: galeria, foco em seções, erro no zoom e comparador aberto por padrão", () => {
  const gallerySrc = readSrc("components/site/VehicleGallery.tsx");
  assert.match(gallerySrc, /!root\.contains\(activeEl\)/);
  assert.match(gallerySrc, /new ResizeObserver\(realign\)/);

  const navSrc = readSrc("components/site/FichaSectionNav.tsx");
  assert.match(navSrc, /focusSectionTarget/);

  const zoomSrc = readSrc("components/site/ZoomDetailImage.tsx");
  assert.match(zoomSrc, /data-zoom-detail-error/);
  assert.match(zoomSrc, /Tentar novamente/);

  const store = globalThis as typeof globalThis & { sessionStorage?: Storage };
  const prev = store.sessionStorage;
  const mem = new Map<string, string>();
  store.sessionStorage = {
    getItem: (key) => mem.get(key) ?? null,
    setItem: (key, val) => { mem.set(key, val); },
    removeItem: (key) => { mem.delete(key); },
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  };
  try {
    assert.deepEqual(readComparisonSession(), { chosen: null, open: true });
    mem.set(COMPARISON_SESSION_KEY, JSON.stringify({ chosen: null, open: false }));
    assert.deepEqual(readComparisonSession(), { chosen: null, open: false });
  } finally {
    store.sessionStorage = prev;
  }
});

test("Auditoria Técnica #06, #07 e #08: GALLERY_HERO_SIZES 100vw no mobile, wordmark 180w e flush offline em idle", () => {
  assert.equal(
    GALLERY_HERO_SIZES,
    "(min-width: 1280px) 710px, (min-width: 1024px) calc((100vw - 96px) * 0.6), 100vw",
  );
  assert.match(WORDMARK_SRC_SET, /\/branding\/logo-wordmark-180\.webp 180w/);
  assert.equal(existsSync(join(root, "public/branding/logo-wordmark-180.webp")), true);

  const flushSrc = readSrc("components/site/OfflineLeadFlush.tsx");
  assert.match(flushSrc, /requestIdleCallback/);
});
