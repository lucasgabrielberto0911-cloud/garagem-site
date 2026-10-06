import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GALLERY_MAX_EDGE } from "./image-variants";
import {
  CARD_SIZES,
  GALLERY_FILE_WIDTH,
  GALLERY_HERO_SIZES,
  coverSrc,
  coverSrcSet,
  coverMobileSrcSet,
  galleryPreviewSrc,
  galleryPreviewSrcSet,
  galleryThumbSrc,
  isActiveStockSort,
  modelAfterBrandChange,
  modelFilterOptions,
  modelsForBrand,
  parseStockFilters,
  shouldLoadGallerySlide,
  stockCityFilter,
  stockOrderBy,
  stockSortLabel,
  stockViewNeedsFetch,
  supabaseCardSrc,
  supabaseOriginalSrc,
} from "./stock-query";

const ORIGINAL =
  "https://vesmqhyxautgtvgccweo.supabase.co/storage/v1/object/public/veiculos/foto.webp";

test("supabaseCardSrc recorta o original do Storage em WebP", () => {
  const src = supabaseCardSrc(ORIGINAL);
  assert.match(src, /\/storage\/v1\/render\/image\/public\/veiculos\/foto\.webp\?/);
  assert.match(src, /width=480/);
  assert.match(src, /height=360/);
  assert.match(src, /resize=cover/);
  assert.match(src, /format=webp/);
  assert.equal(src.includes("/object/public/"), false);
});

test("supabaseOriginalSrc devolve o arquivo se o recorte falhar", () => {
  const rendered = supabaseCardSrc(ORIGINAL, 720, 450);
  assert.equal(supabaseOriginalSrc(rendered), ORIGINAL);
  assert.equal(supabaseOriginalSrc(ORIGINAL), ORIGINAL);
});

function pickWidth(srcSet: string, slotPx: number) {
  const widths = [...srcSet.matchAll(/ (\d+)w/g)].map((match) => Number(match[1]));
  const sorted = [...widths].sort((a, b) => a - b);
  return sorted.find((width) => width >= slotPx) ?? sorted[sorted.length - 1];
}

test("coverSrc usa thumbnail quando existe e recorte quando não", () => {
  assert.equal(
    coverSrc([{ url: ORIGINAL, thumbnailUrl: "https://cdn.example/card.webp" }]),
    "https://cdn.example/card.webp",
  );
  assert.equal(coverSrc([{ url: ORIGINAL, thumbnailUrl: null }]), supabaseCardSrc(ORIGINAL));
  const withThumb = coverSrcSet([
    { url: ORIGINAL, thumbnailUrl: "https://cdn.example/card.webp" },
  ]);
  assert.match(withThumb ?? "", /cdn\.example\/card\.webp 480w/);
  assert.match(withThumb ?? "", /720w/);
  assert.match(withThumb ?? "", /960w/);
  assert.equal(withThumb?.includes(ORIGINAL), false);
  const bare = coverSrcSet([{ url: ORIGINAL }]) ?? "";
  assert.match(bare, /480w/);
  assert.match(bare, /width=720&height=540/);
  assert.match(bare, /width=960&height=720/);
  assert.match(bare, /quality=75/);
  assert.match(bare, /format=webp/);
  assert.equal(bare.includes(`${ORIGINAL} `), false);
  assert.equal(pickWidth(bare, 346), 480);
  assert.equal(pickWidth(bare, ((390 - 44) / 2) * 3), 720);
  assert.equal(pickWidth(bare, ((430 - 44) / 2) * 3), 720);
  assert.equal(pickWidth(bare, 519), 720);
  assert.equal(pickWidth(bare, 584), 720);
  assert.equal(pickWidth(bare, 936), 960);
});

test("capa móvel usa a galeria 4:3, sem esticar o recorte antigo nem baixar versão desktop", () => {
  const mobile = coverMobileSrcSet([{ url: ORIGINAL, thumbnailUrl: "https://cdn.example/old-card.webp" }]) ?? "";
  assert.match(mobile, /width=480&height=360&resize=cover&quality=74/);
  assert.equal(pickWidth(mobile, ((430 - 44) / 2) * 3), 480);
  assert.doesNotMatch(mobile, /old-card|720w|960w/);
  assert.equal(coverMobileSrcSet([{ url: "https://cdn.example/foto.jpg" }]), undefined);
  assert.equal(coverMobileSrcSet([{ url: ORIGINAL.replace(".webp", "-card.webp") }]), undefined);
  assert.equal(coverMobileSrcSet([]), undefined);
});

test("galleryThumbSrc recorta o strip; o hero não usa a miniatura do card", () => {
  const photo = { id: "1", url: ORIGINAL, thumbnailUrl: null as string | null };
  assert.match(galleryThumbSrc(photo), /width=240/);
  assert.match(galleryThumbSrc(photo), /format=webp/);
  assert.equal(galleryPreviewSrc(photo), ORIGINAL);
  const set = galleryPreviewSrcSet(photo) ?? "";
  assert.match(set, /width=800/);
  assert.match(set, /quality=80/);
  assert.match(set, /format=webp/);
  assert.match(set, /800w/);
  assert.match(set, new RegExp(`${ORIGINAL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} 1280w`));
  assert.doesNotMatch(set, /height=/);
  assert.equal(pickWidth(set, 390 * 0.6 * 3), 800);
  assert.equal(pickWidth(set, 430 * 0.6 * 3), 800);
  assert.equal(pickWidth(set, 780), 800);
  assert.equal(pickWidth(set, 1170), 1280);
  assert.equal(pickWidth(set, 1420), 1280);
  assert.equal(
    galleryThumbSrc({ id: "1", url: ORIGINAL, thumbnailUrl: "https://cdn.example/card.webp" }),
    "https://cdn.example/card.webp",
  );
  const withThumb = galleryPreviewSrcSet({
    id: "1",
    url: ORIGINAL,
    thumbnailUrl: "https://cdn.example/card.webp",
  }) ?? "";
  assert.equal(withThumb.includes("cdn.example/card.webp"), false);
  assert.doesNotMatch(withThumb, /480w/);
});

test("JPG antigo da ficha vira WebP a 1200 e não o arquivo cru", () => {
  const jpeg = ORIGINAL.replace(".webp", ".jpg");
  const photo = { id: "1", url: jpeg, thumbnailUrl: null as string | null };
  const src = galleryPreviewSrc(photo);
  assert.match(src, /\/render\/image\/public\//);
  assert.match(src, /width=1200/);
  assert.match(src, /quality=80/);
  assert.match(src, /format=webp/);
  assert.equal(src.includes("/object/public/"), false);
  const set = galleryPreviewSrcSet(photo) ?? "";
  assert.match(set, /800w/);
  assert.match(set, /1200w/);
  assert.equal(set.includes(jpeg), false);
});

test("medidas públicas batem com o layout e com o upload", () => {
  assert.equal(GALLERY_FILE_WIDTH, GALLERY_MAX_EDGE);
  assert.equal(
    GALLERY_HERO_SIZES,
    "(min-width: 1280px) 710px, (min-width: 1024px) calc((100vw - 96px) * 0.6), (min-width: 640px) 100vw, 60vw",
  );
  assert.equal(
    CARD_SIZES,
    "(min-width: 1280px) 292px, (min-width: 1024px) calc((100vw - 96px) / 3), (min-width: 640px) calc((100vw - 64px) / 2), calc((100vw - 44px) / 2)",
  );
  const card = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../components/site/VehicleCard.tsx"),
    "utf8",
  );
  assert.match(card, /CARD_SIZES/);
  assert.doesNotMatch(card, /25vw/);
  const gallery = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../components/site/VehicleGallery.tsx"),
    "utf8",
  );
  assert.match(gallery, /priority=\{index === 0\}/);
  const image = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../components/NativeRemoteFillImage.tsx"),
    "utf8",
  );
  assert.match(image, /loading=\{priority \? "eager" : "lazy"\}/);
  assert.match(image, /fetchPriority=\{priority \? "high" : "low"\}/);
});

test("galeria só baixa o slide ativo e os vizinhos", () => {
  assert.equal(shouldLoadGallerySlide(0, 0), true);
  assert.equal(shouldLoadGallerySlide(1, 0), true);
  assert.equal(shouldLoadGallerySlide(2, 0), false);
  assert.equal(shouldLoadGallerySlide(9, 10), true);
  assert.equal(shouldLoadGallerySlide(7, 10), false);
});

test("filtro de cidade só aceita onde o veículo está", () => {
  assert.deepEqual(stockCityFilter("linhares"), { locationCity: "linhares" });
  assert.deepEqual(stockCityFilter("Serra"), { locationCity: "serra" });
  assert.deepEqual(stockCityFilter("Vitória"), { locationCity: "vitoria" });
  assert.deepEqual(stockCityFilter("aracruz"), { locationCity: "aracruz" });
  assert.deepEqual(stockCityFilter("guarapari"), {});
  assert.equal(parseStockFilters({ city: "Vitória" }).city, "vitoria");
  assert.equal(parseStockFilters({ city: "aracruz" }).city, "aracruz");
  assert.deepEqual(stockCityFilter(""), {});
  assert.equal(parseStockFilters({ city: "linhares" }).city, "linhares");
  assert.equal(parseStockFilters({ city: "Vila Velha" }).city, undefined);
  assert.equal(parseStockFilters({}).city, undefined);
});

test("rótulo de ordenação do estoque cai em mais recentes", () => {
  assert.equal(stockSortLabel("menor-preco"), "Menor preço");
  assert.equal(stockSortLabel("maior-preco"), "Maior preço");
  assert.equal(stockSortLabel("nome"), "Nome (A–Z)");
  assert.equal(stockSortLabel(""), "Mais recentes");
  assert.equal(stockSortLabel(undefined), "Mais recentes");
  assert.equal(stockSortLabel("desconhecido"), "Mais recentes");
});

test("ordenação do estoque usa preço, km, ano e nome", () => {
  assert.deepEqual(stockOrderBy("menor-preco"), { price: "asc" });
  assert.deepEqual(stockOrderBy("maior-preco"), { price: "desc" });
  assert.deepEqual(stockOrderBy("menor-km"), { km: "asc" });
  assert.deepEqual(stockOrderBy("mais-novo"), { yearModel: "desc" });
  assert.deepEqual(stockOrderBy("nome"), [{ brand: "asc" }, { model: "asc" }]);
  assert.deepEqual(stockOrderBy("luxo"), { createdAt: "desc" });
  assert.deepEqual(stockOrderBy(undefined), { createdAt: "desc" });
  assert.equal(isActiveStockSort("nome"), true);
  assert.equal(isActiveStockSort("recentes"), false);
  assert.equal(isActiveStockSort("luxo"), false);
});

test("modelo entra na URL e a ordenação sozinha também busca a lista", () => {
  assert.equal(parseStockFilters({ model: "Civic", brand: "Honda" }).model, "Civic");
  assert.equal(parseStockFilters({}).model, undefined);
  assert.equal(
    stockViewNeedsFetch({ model: "Civic" }),
    true,
  );
  assert.equal(stockViewNeedsFetch({ sort: "nome" }), true);
  assert.equal(stockViewNeedsFetch({ sort: "menor-preco" }), true);
  assert.equal(stockViewNeedsFetch({ sort: "recentes" }), false);
  assert.equal(stockViewNeedsFetch({}), false);

  const filters = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../components/site/StockFilters.tsx"),
    "utf8",
  );
  const browse = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../components/site/EstoqueBrowse.tsx"),
    "utf8",
  );
  const vehicles = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../lib/vehicles.ts"),
    "utf8",
  );
  assert.match(filters, /Todos os modelos/);
  assert.match(filters, /desktop-modelo/);
  assert.match(filters, /transmissionFilterParam/);
  assert.match(filters, /desktop-cambio/);
  assert.match(filters, /sticky-gear-/);
  assert.match(browse, /stockViewNeedsFetch/);
  assert.match(vehicles, /stockOrderBy\(filters\.sort\)/);
  assert.match(vehicles, /model: \{/);
  const where = vehicles.slice(
    vehicles.indexOf("function buildStockWhere"),
    vehicles.indexOf("function stockQueryKey"),
  );
  assert.match(where, /transmissionWhere\(filters\.transmission\)/);
  assert.match(where, /and\.push\(gear\)/);
  assert.doesNotMatch(where, /transmission: filters\.transmission/);
  assert.match(vehicles, /stock-page-v12/);
  assert.equal(parseStockFilters({ transmission: "automatico" }).transmission, "automatico");
  assert.equal(stockViewNeedsFetch({ transmission: "automatico" }), true);
  assert.equal(stockViewNeedsFetch({ transmission: "manual" }), true);
  assert.doesNotMatch(filters, /blindagem|Blindado|Consignado|Confirmado neste/i);
  assert.doesNotMatch(browse, /99633|9\d{4}-\d{4}/);
});

test("modelo acompanha a marca escolhida", () => {
  const models = [
    { brand: "Honda", model: "Civic" },
    { brand: "Honda", model: "HR-V" },
    { brand: "Fiat", model: "Mobi" },
  ];
  assert.deepEqual(modelsForBrand(models, "Honda"), ["Civic", "HR-V"]);
  assert.deepEqual(modelsForBrand(models, ""), ["Civic", "HR-V", "Mobi"]);
  assert.deepEqual(modelAfterBrandChange(models, "Fiat", "Civic"), "");
  assert.equal(modelAfterBrandChange(models, "honda", "civic"), "Civic");
  assert.deepEqual(modelFilterOptions(models, "Fiat", "Civic"), ["Civic", "Mobi"]);
});
