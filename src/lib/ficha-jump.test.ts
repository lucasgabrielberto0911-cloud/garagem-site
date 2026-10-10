import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { FichaSectionNav } from "@/components/site/FichaSectionNav";
import { VehicleMobileBlocks } from "@/components/site/VehicleMobileDossier";
import { FavoritesProvider } from "@/lib/favorites";
import { DEFAULT_GOOGLE_REVIEWS } from "@/lib/google-reviews";
import { DEFAULT_VEHICLE_CONDITIONS } from "@/lib/vehicle-conditions";
import type { VehicleSpecRow } from "@/lib/vehicle-specs";
import {
  fichaSectionLinks,
  fichaSectionScrollTop,
} from "./ficha-sections";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

const specs: VehicleSpecRow[] = [
  { label: "Ano", value: "2014/2015" },
  { label: "KM", value: "106.000" },
  { label: "Câmbio", value: "Automático" },
  { label: "Combustível", value: "Flex" },
  { label: "Cor", value: "Prata" },
  { label: "Motor", value: "2.0" },
];

function blocks(options: { description?: string; accessories?: string[] }) {
  return renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleMobileBlocks, {
        fullLabel: "Honda HR-V",
        path: "/estoque/hrv",
        sold: false,
        price: 84900,
        yearModel: 2016,
        make: "Honda",
        model: "HR-V",
        vehicleId: "v1",
        description: options.description,
        accessories: options.accessories ?? [],
        specs,
        inspection: null,
        conditions: DEFAULT_VEHICLE_CONDITIONS,
        google: DEFAULT_GOOGLE_REVIEWS,
        prompt: "dúvida",
      }),
    ),
  );
}

test("âncoras da ficha são fotos, especificações e detalhes", () => {
  assert.deepEqual(
    fichaSectionLinks(true).map((link) => link.label),
    ["Fotos", "Especificações", "Detalhes"],
  );
  assert.deepEqual(
    fichaSectionLinks(false).map((link) => link.id),
    ["fotos", "especificacoes"],
  );
  assert.equal(fichaSectionScrollTop(400, 120, 800), 1072);
  assert.equal(fichaSectionScrollTop(10, 200, 0), 0);

  const withDetails = renderToStaticMarkup(
    createElement(FichaSectionNav, { hasDetails: true }),
  );
  assert.match(withDetails, /href="#fotos"/);
  assert.match(withDetails, /href="#especificacoes"/);
  assert.match(withDetails, /href="#detalhes"/);
  assert.match(withDetails, /Seções do anúncio/);
  assert.doesNotMatch(withDetails, /WhatsApp|99633|99956|Confirmado|Equipamentos/);

  const photosOnly = renderToStaticMarkup(
    createElement(FichaSectionNav, { hasDetails: false }),
  );
  assert.match(photosOnly, /href="#fotos"/);
  assert.doesNotMatch(photosOnly, /href="#detalhes"/);
});

test("a ficha marca fotos, especificações e o texto, e abre a foto grande em WebP", () => {
  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  const gallery = readSrc("components/site/VehicleGallery.tsx");
  const lightbox = readSrc("components/site/PhotoLightbox.tsx");
  const css = readSrc("app/globals.css");

  assert.match(page, /FichaSectionNav/);
  assert.match(page, /data-ficha-section="fotos"/);
  assert.match(page, /data-ficha-section="especificacoes"/);
  assert.match(page, /data-ficha-section="detalhes"/);
  assert.match(page, /data-ficha-page/);
  assert.match(page, /VehicleViewContent/);
  assert.match(page, /VehicleLeadHit/);
  assert.match(page, /trackingLabel="ficha"/);
  assert.match(page, /Tenho interesse/);
  assert.match(page, /VehicleTrustNotes/);
  assert.match(page, /site\.whatsappLabel/);
  assert.match(page, /MissingModelForm/);
  assert.match(page, /sourcePage="ficha"/);
  assert.match(gallery, /Ampliar foto/);
  assert.match(gallery, /setZoomOpen\(true\)/);
  assert.match(lightbox, /galleryPreviewSrc\(photo\)/);
  assert.match(lightbox, /galleryThumbSrc/);
  assert.doesNotMatch(lightbox, /photo\?\.url/);
  assert.doesNotMatch(lightbox, /format=avif/);
  assert.doesNotMatch(gallery, /format=avif/);
  assert.doesNotMatch(page, /format=avif/);
  assert.doesNotMatch(page, /Confirmado neste anúncio/i);
  assert.doesNotMatch(page, /Equipamentos/);
  assert.doesNotMatch(page, /99956-6161|5527999566161/);
  assert.doesNotMatch(page, /0-100|cavalos|potência/i);

  const foldStart = css.indexOf(".ficha-mobile-fold {");
  const fold = css.slice(foldStart, foldStart + 500);
  assert.match(fold, /var\(--ficha-section-nav\)/);
  assert.match(css, /\.ficha-section-nav/);
  assert.match(css, /scroll-margin-top/);
});

test("especificações e detalhes apontam para o que o anúncio já tem", () => {
  const html = blocks({
    description: "Sedã médio automático, revisões na loja.",
    accessories: ["Ar-condicionado"],
  });
  assert.match(html, /id="especificacoes"/);
  assert.match(html, /data-ficha-section="especificacoes"/);
  assert.match(html, /id="detalhes"/);
  assert.match(html, /Sobre o veículo/);
  assert.ok(
    html.indexOf('id="detalhes"') < html.indexOf("Sobre o veículo") ||
      html.indexOf("Sobre o veículo") < html.indexOf('id="detalhes"') + 200,
  );
  const about = html.slice(html.indexOf('id="detalhes"'), html.indexOf('id="detalhes"') + 500);
  assert.match(about, /Sobre o veículo/);
  assert.doesNotMatch(html, /0-100|cavalos|potência/i);
  assert.doesNotMatch(html, /Confirmado neste anúncio/i);
  assert.doesNotMatch(html, /Equipamentos/);

  const itemsOnly = blocks({ accessories: ["Direção elétrica"] });
  const itemsAt = itemsOnly.indexOf("Itens e acessórios");
  const detailsAt = itemsOnly.indexOf('id="detalhes"');
  assert.ok(detailsAt >= 0 && itemsAt > detailsAt);
  assert.doesNotMatch(itemsOnly, /Sobre o veículo/);

  const noText = blocks({});
  assert.doesNotMatch(noText, /id="detalhes"/);
  assert.match(noText, /id="especificacoes"/);
});

test("filtros do estoque e o estoque inteiro das cidades ficam como estão", () => {
  const filters = readSrc("components/site/StockFilters.tsx");
  const stock = readSrc("app/(catalog)/estoque/page.tsx");
  const city = readSrc("app/(site)/seminovos/[cidade]/page.tsx");
  const vehicles = readSrc("lib/vehicles.ts");
  const form = readSrc("components/site/MissingModelForm.tsx");

  assert.match(stock, /StockFilters/);
  assert.match(filters, /label="Marca"/);
  assert.match(filters, /label="Modelo"/);
  assert.match(filters, /maxKm/);
  assert.match(filters, /Ano mín\./);
  assert.match(city, /getCityShowcaseVehicles\(\)/);
  assert.match(city, /vehicles=\{featured\}/);
  assert.doesNotMatch(city, /useSearchParams|EstoqueBrowse|\/api\/estoque/);
  const showcase = vehicles.slice(
    vehicles.indexOf("async function fetchCityShowcaseVehicles"),
    vehicles.indexOf("const loadCityShowcaseCached"),
  );
  assert.match(showcase, /status: "disponivel"/);
  assert.doesNotMatch(showcase, /locationCity|take:/);
  assert.match(form, /export function MissingModelForm/);
});
