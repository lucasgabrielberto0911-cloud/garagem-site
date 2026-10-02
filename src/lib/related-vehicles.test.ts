import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { SimilarVehicles } from "@/components/site/SimilarVehicles";
import { FavoritesProvider } from "@/lib/favorites";
import type { VehicleCardData } from "@/components/site/VehicleCard";
import {
  pickRelatedVehicles,
  priceBandHref,
  priceBandRange,
  relatedVehicleScore,
  type RelatedVehicleCandidate,
} from "./related-vehicles";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

function vehicle(
  overrides: Partial<RelatedVehicleCandidate> & Pick<RelatedVehicleCandidate, "id">,
): RelatedVehicleCandidate {
  return {
    brand: "Fiat",
    category: "carro",
    price: 90000,
    transmission: "Manual",
    status: "disponivel",
    ...overrides,
  };
}

test("faixa de preço usa ±20% com piso de 8 mil", () => {
  assert.deepEqual(priceBandRange(89900), { min: 71920, max: 107880 });
  assert.deepEqual(priceBandRange(25000), { min: 17000, max: 33000 });
  assert.deepEqual(priceBandRange(15200), { min: 7200, max: 23200 });
  assert.deepEqual(priceBandRange(0), { min: 0, max: 0 });
  assert.equal(priceBandHref(89900), "/estoque?minPrice=71920&maxPrice=107880");
  assert.equal(priceBandHref(0), "/estoque");
});

test("mesma faixa pontua mais que marca distante no preço", () => {
  const current = { brand: "Fiat", category: "carro", price: 89900 };
  const sameBand = relatedVehicleScore(
    {
      id: "pulse",
      brand: "Hyundai",
      category: "carro",
      price: 92900,
    },
    current,
  );
  const sameBrandFar = relatedVehicleScore(
    {
      id: "toro",
      brand: "Fiat",
      category: "carro",
      price: 189000,
    },
    current,
  );
  assert.ok(sameBand > sameBrandFar);
});

test("moto sugere moto perto e deixa de fora carro, vendido e consignado", () => {
  const picked = pickRelatedVehicles(
    [
      vehicle({
        id: "self",
        brand: "Honda",
        category: "moto",
        price: 15200,
        transmission: "Manual",
      }),
      vehicle({
        id: "biz",
        brand: "Honda",
        category: "moto",
        price: 14900,
        transmission: "Manual",
      }),
      vehicle({
        id: "cg",
        brand: "Honda",
        category: "moto",
        price: 17000,
        transmission: "Manual",
      }),
      vehicle({
        id: "civic",
        brand: "Honda",
        category: "carro",
        price: 74900,
        transmission: "Automático",
      }),
      vehicle({
        id: "sold",
        brand: "Honda",
        category: "moto",
        price: 16000,
        status: "vendido",
      }),
      vehicle({
        id: "flag",
        brand: "Yamaha",
        category: "moto",
        price: 15500,
        consigned: true,
      }),
      vehicle({
        id: "label",
        brand: "Yamaha",
        model: "Factor",
        version: "Consignado",
        category: "moto",
        price: 15800,
      }),
    ],
    {
      id: "self",
      brand: "Honda",
      category: "moto",
      price: 15200,
      transmission: "Manual",
    },
    4,
  );
  assert.deepEqual(
    picked.map((item) => item.id),
    ["biz", "cg"],
  );
});

test("prefere marca ou câmbio quando ainda fecha quatro na faixa", () => {
  const current = {
    id: "self",
    brand: "Honda",
    category: "carro",
    price: 90000,
    transmission: "Manual",
  };
  const picked = pickRelatedVehicles(
    [
      vehicle({ id: "self", brand: "Honda", price: 90000, transmission: "Manual" }),
      vehicle({ id: "h1", brand: "Honda", price: 88000, transmission: "Manual" }),
      vehicle({ id: "h2", brand: "Honda", price: 91000, transmission: "Automático" }),
      vehicle({ id: "h3", brand: "Honda", price: 95000, transmission: "Manual" }),
      vehicle({ id: "h4", brand: "Honda", price: 99000, transmission: "Manual" }),
      vehicle({
        id: "closer",
        brand: "Fiat",
        price: 90100,
        transmission: "Automático",
      }),
    ],
    current,
    4,
  );
  assert.deepEqual(
    picked.map((item) => item.id),
    ["h1", "h3", "h4", "h2"],
  );
});

test("com menos de quatro da mesma marca ou câmbio, completa a faixa", () => {
  const picked = pickRelatedVehicles(
    [
      vehicle({ id: "same", brand: "Honda", price: 92000, transmission: "Manual" }),
      vehicle({ id: "a", brand: "Fiat", price: 88000, transmission: "Manual" }),
      vehicle({ id: "b", brand: "VW", price: 91000, transmission: "Manual" }),
      vehicle({ id: "c", brand: "Hyundai", price: 86000, transmission: "Manual" }),
      vehicle({ id: "far", brand: "Honda", price: 180000, transmission: "Automático" }),
      vehicle({
        id: "moto",
        brand: "Honda",
        category: "moto",
        price: 89000,
        transmission: "Automático",
      }),
    ],
    {
      id: "self",
      brand: "Honda",
      category: "carro",
      price: 90000,
      transmission: "Automático",
    },
    4,
  );
  assert.deepEqual(
    picked.map((item) => item.id),
    ["same", "b", "a", "c"],
  );
});

test("sem ninguém na faixa, não sugere nada", () => {
  const picked = pickRelatedVehicles(
    [
      vehicle({ id: "far", price: 200000 }),
      vehicle({ id: "sold", price: 90000, status: "vendido" }),
    ],
    { id: "self", brand: "Fiat", category: "carro", price: 50000 },
    4,
  );
  assert.deepEqual(picked, []);
});

test("câmbio escrito de outro jeito ainda conta como o mesmo", () => {
  const picked = pickRelatedVehicles(
    [
      vehicle({
        id: "auto",
        brand: "Hyundai",
        price: 91000,
        transmission: "Automatico",
        version: "Drive 1.3 Flex",
      }),
      vehicle({
        id: "manual",
        brand: "Hyundai",
        price: 90500,
        transmission: "Manual",
      }),
      vehicle({ id: "other", brand: "Fiat", price: 89000, transmission: "Manual" }),
      vehicle({ id: "vw", brand: "VW", price: 87000, transmission: "Manual" }),
      vehicle({ id: "renault", brand: "Renault", price: 86000, transmission: "Manual" }),
    ],
    {
      id: "self",
      brand: "Honda",
      category: "carro",
      price: 90000,
      transmission: "Automático",
    },
    4,
  );
  assert.equal(picked[0]?.id, "auto");
  assert.equal(picked.length, 4);
});

function card(overrides: Partial<VehicleCardData> = {}): VehicleCardData {
  return {
    id: "cmud192iz0000l6041ewv0ki6",
    category: "carro",
    brand: "Hyundai",
    model: "HB20S",
    version: "Comfort Plus",
    yearModel: 2024,
    km: 32000,
    price: 87900,
    transmission: "Automático",
    fuel: "Flex",
    status: "disponivel",
    featured: false,
    color: "Prata",
    locationCity: "linhares",
    photos: [{ url: "https://example.com/hb20s.jpg", thumbnailUrl: null }],
    ...overrides,
  };
}

test("o bloco mostra foto, nome, ano, km e preço, e some se não houver opção", () => {
  const html = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(SimilarVehicles, {
        vehicles: [card()],
        title: "Carros na mesma faixa",
        description: "Se este não fechar, estes estão na mesma faixa. Abra a ficha.",
        stockHref: "/estoque?minPrice=71920&maxPrice=107880",
        whatsapp: {
          message: "Oi",
          trackingLabel: "ficha-mesma-faixa",
          content: "hb20s",
          vehicleId: "current",
          slug: "atual",
        },
      }),
    ),
  );

  assert.match(html, /data-similar-vehicles/);
  assert.match(html, /https:\/\/example\.com\/hb20s\.jpg/);
  assert.match(html, /Hyundai HB20S/);
  assert.match(html, />2024</);
  assert.match(html, /32\.000 km/);
  assert.match(html, /R\$\s*87\.900/);
  assert.match(html, /href="\/estoque\/hyundai-hb20s-comfort-plus-2024-cmud192iz0000l6041ewv0ki6"/);
  assert.match(html, /wa\.me\/5527996330706/);
  assert.doesNotMatch(html, /99956|5527999566161/);
  assert.doesNotMatch(html, /Tenho interesse/);
  assert.doesNotMatch(html, /Equipamentos/);
  assert.doesNotMatch(html, /Confirmado neste anúncio/i);
  assert.doesNotMatch(html, /Consignado/i);

  const article = html.slice(html.indexOf("<article"), html.indexOf("</article>"));
  assert.match(article, /Hyundai HB20S/);
  assert.doesNotMatch(article, /wa\.me|Tenho interesse/);

  const empty = renderToStaticMarkup(
    createElement(SimilarVehicles, {
      vehicles: [],
      title: "Carros na mesma faixa",
      description: "nada",
      stockHref: "/estoque",
    }),
  );
  assert.equal(empty, "");

  const missingKm = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(SimilarVehicles, {
        vehicles: [card({ km: undefined as unknown as number, yearModel: undefined as unknown as number, price: 0 })],
        title: "Carros na mesma faixa",
        description: "Sem inventar dado.",
        stockHref: "/estoque",
      }),
    ),
  );
  assert.match(missingKm, /Hyundai HB20S/);
  assert.doesNotMatch(missingKm, /km/);
  assert.doesNotMatch(missingKm, />2024</);
  assert.doesNotMatch(missingKm, /R\$/);
});

test("a ficha mantém âncoras, filtros e o formulário, e as cidades o estoque inteiro", () => {
  const page = readSrc("app/(site)/estoque/[id]/page.tsx");
  const similar = readSrc("components/site/SimilarVehicles.tsx");
  const filters = readSrc("components/site/StockFilters.tsx");
  const form = readSrc("components/site/MissingModelForm.tsx");
  const sections = readSrc("lib/ficha-sections.ts");
  const vehicles = readSrc("lib/vehicles.ts");
  const city = readSrc("app/(site)/seminovos/[cidade]/page.tsx");

  assert.match(page, /SimilarVehicles/);
  assert.match(page, /display\.transmission/);
  assert.match(page, /FichaSectionNav/);
  assert.match(page, /data-ficha-section="fotos"/);
  assert.match(page, /data-ficha-section="especificacoes"/);
  assert.match(page, /data-ficha-section="detalhes"/);
  assert.match(page, /MissingModelForm/);
  assert.match(page, /sourcePage="ficha"/);
  assert.ok(
    page.indexOf("<MissingModelForm") < page.indexOf("<SimilarVehicles"),
  );
  assert.doesNotMatch(similar, /showWhatsApp|whatsappCampaign/);
  assert.doesNotMatch(readSrc("components/site/VehicleCard.tsx"), /VehicleCardWhatsApp|Tenho interesse/);
  assert.doesNotMatch(similar, /setTimeout|Equipamentos|Confirmado neste anúncio|99956/i);
  assert.doesNotMatch(page, /Confirmado neste anúncio|Equipamentos|99956/);

  assert.match(filters, /label="Marca"/);
  assert.match(filters, /label="Modelo"/);
  assert.match(filters, /maxKm/);
  assert.match(form, /export function MissingModelForm/);
  assert.match(sections, /Fotos/);
  assert.match(sections, /Especificações/);
  assert.match(sections, /Detalhes/);

  assert.match(city, /getCityShowcaseVehicles\(\)/);
  assert.match(city, /vehicles=\{featured\}/);
  assert.doesNotMatch(city, /useSearchParams|EstoqueBrowse|\/api\/estoque/);
  const showcase = vehicles.slice(
    vehicles.indexOf("async function fetchCityShowcaseVehicles"),
    vehicles.indexOf("const loadCityShowcaseCached"),
  );
  assert.match(showcase, /status: "disponivel"/);
  assert.doesNotMatch(showcase, /locationCity|take:|consigned/);

  const related = vehicles.slice(
    vehicles.indexOf("async function findRelatedCardPool"),
    vehicles.indexOf("const loadRelatedCached"),
  );
  assert.match(related, /consigned: false/);
  assert.match(related, /status: "disponivel"/);
  assert.match(related, /historical: false/);
  assert.doesNotMatch(related, /take: 48/);
});
