import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { VehicleCard } from "@/components/site/VehicleCard";
import { VehicleMobileBar } from "@/components/site/VehicleMobileBar";
import { STATUSES } from "@/components/admin/vehicle-form/types";
import { FavoritesProvider } from "@/lib/favorites";
import {
  adminCardOverflowStatuses,
  adminCardShowsSoldAction,
} from "@/lib/admin-list";
import { quickPriceError } from "@/lib/admin-quick-price";
import { mapAdminVehicleStatsRow } from "@/lib/admin-vehicles";
import { catalogStatusFor } from "@/lib/catalog-feed-status";
import { publicCardFacts } from "@/lib/public-card-facts";
import {
  AWAITING_DELIVERY_LABEL,
  AWAITING_DELIVERY_STATUS,
  PUBLIC_LISTING_VEHICLE_WHERE,
  PUBLIC_SITEMAP_VEHICLE_WHERE,
  isAwaitingDeliveryStatus,
  isPublicStockVehicle,
  isSoldOrAwaitingDelivery,
} from "@/lib/public-stock";
import { vehicleAvailabilityUrl, vehicleJsonLd } from "@/lib/seo";
import { vehicleModelLandingPath } from "@/lib/stock-landings";
import { parseStockFilters } from "@/lib/stock-query";
import { editListingGaps, publishMissingItems } from "@/lib/stock-quality";
import {
  buildWhatsAppCarMessage,
  featuredBadgeIds,
  formatVehicleWhatsAppMessage,
} from "@/lib/vehicle-display";
import { buildVehicleFichaMetadata } from "@/lib/vehicle-seo";
import { buildStockWhere } from "@/lib/vehicles";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relPath: string) {
  return readFileSync(join(srcRoot, relPath), "utf8");
}

const FAKE_AWAITING_VEHICLE = {
  id: "veh-fake-awaiting-01",
  category: "carro",
  brand: "Marca Teste",
  model: "Modelo Exemplo",
  version: "1.6 Flex",
  yearModel: 2022,
  km: 42000,
  price: 68900,
  transmission: "Automático",
  fuel: "Flex",
  status: AWAITING_DELIVERY_STATUS,
  featured: true,
  color: "Branco",
  catalog: false,
  priceDrop: 2500,
  createdAt: new Date("2026-11-20T10:00:00Z"),
  updatedAt: new Date("2026-11-24T10:00:00Z"),
  photos: [
    {
      url: "/branding/placeholder-car.png",
      thumbnailUrl: "/branding/placeholder-car.png",
    },
  ],
};

test("constantes e helpers de aguardando_entrega são distintos de vendido e disponivel", () => {
  assert.equal(AWAITING_DELIVERY_STATUS, "aguardando_entrega");
  assert.equal(AWAITING_DELIVERY_LABEL, "Vendido, aguardando entrega");
  assert.equal(isAwaitingDeliveryStatus("aguardando_entrega"), true);
  assert.equal(isAwaitingDeliveryStatus("vendido"), false);
  assert.equal(isSoldOrAwaitingDelivery("aguardando_entrega"), true);
  assert.equal(isSoldOrAwaitingDelivery("vendido"), true);
  assert.equal(isSoldOrAwaitingDelivery("disponivel"), false);
  assert.equal(
    isPublicStockVehicle({ status: "aguardando_entrega", historical: false }),
    false,
  );
  assert.equal(PUBLIC_SITEMAP_VEHICLE_WHERE.status, "disponivel");
  assert.deepEqual(PUBLIC_LISTING_VEHICLE_WHERE.status.in, [
    "disponivel",
    "aguardando_entrega",
  ]);
});

test("card aguardando_entrega mostra selo vermelho discreto na área de texto, oculta preço/Tenho interesse e mostra link para o modelo", () => {
  const facts = publicCardFacts(FAKE_AWAITING_VEHICLE);
  assert.equal(facts.priceLabel, "");

  const html = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleCard, {
        vehicle: FAKE_AWAITING_VEHICLE,
        showDestaque: true,
      }),
    ),
  );

  assert.match(html, /listing-card-badge--awaiting/);
  assert.match(html, /Vendido, aguardando entrega/);
  // Selo fica dentro da área de texto, nunca sobre a foto.
  const photoEnd = html.indexOf("data-vehicle-body=");
  const badgePos = html.indexOf("Vendido, aguardando entrega");
  assert.ok(photoEnd > 0 && badgePos > photoEnd);

  // Sem preço, sem Tenho interesse, sem Destaque/Novo/Baixou.
  assert.doesNotMatch(html, /68\.900/);
  assert.doesNotMatch(html, /Tenho interesse/);
  assert.doesNotMatch(html, /Destaque/);
  assert.doesNotMatch(html, /Baixou/);
  assert.doesNotMatch(html, />Novo</);

  // Link discreto para a página do modelo.
  const expectedModelPath = vehicleModelLandingPath(FAKE_AWAITING_VEHICLE);
  assert.equal(expectedModelPath, "/modelo/marca-teste-modelo-exemplo");
  assert.match(html, /href="\/modelo\/marca-teste-modelo-exemplo"/);
  assert.match(html, />Quero um parecido</);

  const css = readSrc("app/globals.css");
  const badgeCss = css.slice(
    css.indexOf(".listing-card-badge--awaiting"),
    css.indexOf(".listing-card-badge--muted"),
  );
  assert.match(badgeCss, /rgba\(232,\s*24,\s*28/);
  assert.match(badgeCss, /#ff6b6e/);
  assert.doesNotMatch(badgeCss, /gold|amber|yellow|#ffc72c|#ff8a00/i);
});

test("aguardando_entrega continua visível em /estoque, mas nunca entra em destaques nem em /links", () => {
  const stockWhere = buildStockWhere(parseStockFilters({}));
  assert.deepEqual(stockWhere.status, {
    in: ["disponivel", "aguardando_entrega"],
  });

  const ids = featuredBadgeIds([
    { id: "v-awaiting", featured: true, status: AWAITING_DELIVERY_STATUS },
    { id: "v-disponivel", featured: true, status: "disponivel" },
  ]);
  assert.equal(ids.has("v-awaiting"), false);
  assert.equal(ids.has("v-disponivel"), true);

  const vehiclesSource = readSrc("lib/vehicles.ts");
  const showcaseStart = vehiclesSource.indexOf("async function findShowcaseCards");
  const showcaseEnd = vehiclesSource.indexOf("async function fetchFeaturedVehicles");
  const showcaseBlock = vehiclesSource.slice(showcaseStart, showcaseEnd);
  assert.match(showcaseBlock, /status:\s*"disponivel"/);

  const linksSource = readSrc("app/links/page.tsx");
  assert.match(linksSource, /getFeaturedVehicles/);

  const landingData = readSrc("lib/stock-landing-data.ts");
  assert.match(landingData, /"aguardando_entrega"/);
});

test("SEO, JSON-LD, catálogo Meta e WhatsApp omitem preço e marcam fora de estoque para aguardando_entrega", () => {
  const metadata = buildVehicleFichaMetadata({
    id: FAKE_AWAITING_VEHICLE.id,
    brand: FAKE_AWAITING_VEHICLE.brand,
    model: FAKE_AWAITING_VEHICLE.model,
    version: FAKE_AWAITING_VEHICLE.version,
    yearModel: FAKE_AWAITING_VEHICLE.yearModel,
    km: FAKE_AWAITING_VEHICLE.km,
    price: FAKE_AWAITING_VEHICLE.price,
    transmission: FAKE_AWAITING_VEHICLE.transmission,
    color: FAKE_AWAITING_VEHICLE.color,
    category: FAKE_AWAITING_VEHICLE.category,
    status: AWAITING_DELIVERY_STATUS,
    photos: FAKE_AWAITING_VEHICLE.photos,
  });
  assert.deepEqual(metadata.robots, { index: false, follow: true });
  assert.doesNotMatch(String(metadata.title), /68\.900/);
  assert.doesNotMatch(String(metadata.description), /68\.900/);

  const jsonLd = vehicleJsonLd({
    ...FAKE_AWAITING_VEHICLE,
    year: 2022,
    description: "Preço R$ 68.900 à vista. Revisado.",
  });
  const offers = jsonLd.offers as { price?: number; availability?: string };
  assert.equal("price" in offers, false);
  assert.equal(offers.availability, vehicleAvailabilityUrl("aguardando_entrega"));
  assert.equal(offers.availability, "https://schema.org/OutOfStock");

  const catalogStatus = catalogStatusFor({
    ...FAKE_AWAITING_VEHICLE,
    photos: [{ id: "photo-fake-01", ...FAKE_AWAITING_VEHICLE.photos[0]! }],
    description: null,
    consigned: false,
    historical: false,
  });
  assert.equal(catalogStatus.inCatalog, false);
  assert.ok(catalogStatus.reasons.includes("Vendido, aguardando entrega"));

  const msg1 = buildWhatsAppCarMessage({
    ...FAKE_AWAITING_VEHICLE,
    path: "/estoque/modelo-exemplo",
  });
  const msg2 = formatVehicleWhatsAppMessage({
    ...FAKE_AWAITING_VEHICLE,
    path: "/estoque/modelo-exemplo",
  });
  assert.doesNotMatch(msg1, /68\.900/);
  assert.doesNotMatch(msg2, /68\.900/);
});

test("ficha e barra mobile exibem selo vermelho e link discreto Quero um parecido sem Tenho interesse", () => {
  const barHtml = renderToStaticMarkup(
    createElement(VehicleMobileBar, {
      vehicleId: FAKE_AWAITING_VEHICLE.id,
      contentName: "Marca Teste Modelo Exemplo",
      brand: FAKE_AWAITING_VEHICLE.brand,
      model: FAKE_AWAITING_VEHICLE.model,
      status: AWAITING_DELIVERY_STATUS,
      year: FAKE_AWAITING_VEHICLE.yearModel,
      price: 0,
      sold: true,
      soldHref: "/modelo/marca-teste-modelo-exemplo",
      soldLabel: "Quero um parecido",
      soldVariant: "subtle",
    }),
  );
  assert.match(barHtml, /href="\/modelo\/marca-teste-modelo-exemplo"/);
  assert.match(barHtml, />Quero um parecido</);
  assert.doesNotMatch(barHtml, /WhatsApp/);
  assert.doesNotMatch(barHtml, /68\.900/);

  const page = readSrc("app/(vehicle)/estoque/[id]/page.tsx");
  assert.match(page, /isAwaitingDeliveryStatus\(vehicle\.status\)/);
  assert.match(page, /AWAITING_DELIVERY_LABEL/);
  assert.match(page, /Quero um parecido/);
  assert.match(page, /\{!awaitingDelivery \? \(/);
});

test("admin permite escolher aguardando_entrega, mantém visível no estoque e impede preço rápido/pendências", () => {
  assert.ok(
    STATUSES.some(
      (item) =>
        item.value === "aguardando_entrega" &&
        item.label === "Vendido, aguardando entrega",
    ),
  );
  assert.equal(adminCardShowsSoldAction("aguardando_entrega"), true);
  assert.deepEqual(
    adminCardOverflowStatuses("aguardando_entrega").map((o) => o.value),
    ["disponivel"],
  );
  assert.ok(
    quickPriceError({ raw: "70000", status: "aguardando_entrega" }),
  );
  assert.deepEqual(
    editListingGaps({
      status: "aguardando_entrega",
      color: null,
      photoCount: 0,
      price: 0,
    }),
    [],
  );
  assert.deepEqual(
    publishMissingItems({
      status: "aguardando_entrega",
      photoCount: 0,
      brand: "",
    }),
    [],
  );

  const stats = mapAdminVehicleStatsRow({
    available: 5,
    reserved: 1,
    awaitingDelivery: 2,
    sold: 3,
    ownedAvailable: 4,
  });
  assert.equal(stats.available, 5);
  assert.equal(stats.estoqueCount, 8);

  const adminVehiclesSrc = readSrc("lib/admin-vehicles.ts");
  assert.match(
    adminVehiclesSrc,
    /\["disponivel",\s*"reservado",\s*"aguardando_entrega"\]/,
  );

  const actionsSrc = readSrc("app/admin/veiculos/actions.ts");
  assert.match(actionsSrc, /"aguardando_entrega"/);
});
