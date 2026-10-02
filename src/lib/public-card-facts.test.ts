import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { HideStockCardInterest } from "@/components/site/HideStockCardInterest";
import { clipChipText, VehicleCard } from "@/components/site/VehicleCard";
import { VehicleCardWhatsApp } from "@/components/site/VehicleCardWhatsApp";
import { FavoritesProvider } from "@/lib/favorites";
import { publicCardFacts } from "@/lib/public-card-facts";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

const hrv = {
  brand: "Honda",
  model: "HR-V",
  version: "EXL 1.8 Flexone",
  yearModel: 2016,
  km: 103000,
  transmission: "Automático",
  locationCity: "linhares",
  price: 84900,
};

test("card completo mostra título curto, preço, ano, km, câmbio e cidade", () => {
  const card = publicCardFacts(hrv);
  assert.equal(card.title, "Honda HR-V");
  assert.equal(card.version, "EXL 1.8 Flexone");
  assert.equal(card.priceLabel.replace(/\u00a0/g, " "), "R$ 84.900");
  assert.deepEqual(
    card.facts.map((fact) => `${fact.label}: ${fact.value}`),
    ["Ano: 2016", "Km: 103.000 km", "Câmbio: Automático", "Cidade: Linhares"],
  );
  assert.equal(card.facts.some((fact) => fact.value === "—"), false);
});

test("versão curta tira lixo FIPE e não repete o câmbio no título", () => {
  const civic = publicCardFacts({
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0 FLEX 16v",
    yearModel: 2020,
    km: 65000,
    transmission: "Automático",
    locationCity: "serra",
    price: 126900,
  });
  assert.equal(civic.title, "Honda Civic");
  assert.equal(civic.version, "EXL 2.0 Flex");
  assert.equal(
    civic.facts.find((fact) => fact.label === "Câmbio")?.value,
    "Automático",
  );

  const lancer = publicCardFacts({
    brand: "Mitsubishi",
    model: "LANCER",
    version: "2.0 Automatico",
    yearModel: 2014,
    km: 80000,
    transmission: "Automático",
    price: 62900,
    locationCity: "linhares",
  });
  assert.equal(lancer.title, "Mitsubishi Lancer");
  assert.equal(lancer.version, "2.0");
  assert.equal(
    lancer.facts.find((fact) => fact.label === "Câmbio")?.value,
    "Automático",
  );
});

test("fato vazio some do card e não vira traço, zero ou cidade padrão", () => {
  const card = publicCardFacts({
    brand: "Fiat",
    model: "Palio",
    version: "",
    yearModel: 0,
    km: null,
    transmission: " ",
    locationCity: null,
    price: 0,
  });
  assert.equal(card.title, "Fiat Palio");
  assert.equal(card.version, "");
  assert.equal(card.priceLabel, "");
  assert.deepEqual(card.facts, []);

  const partial = publicCardFacts({
    brand: "Honda",
    model: "CG 160 Start",
    version: "160 Start",
    yearModel: 2023,
    km: 450,
    transmission: "Manual",
    locationCity: "Vitória",
    price: Number.NaN,
  });
  assert.equal(partial.version, "");
  assert.equal(partial.priceLabel, "");
  assert.deepEqual(
    partial.facts.map((fact) => fact.label),
    ["Ano", "Km", "Câmbio"],
  );
  assert.equal(
    partial.facts.find((fact) => fact.label === "Cidade"),
    undefined,
  );
  assert.equal(partial.facts.some((fact) => fact.value === "Linhares"), false);
});

test("km zero permanece; km inválido e câmbio ausente não são inventados", () => {
  const zero = publicCardFacts({
    brand: "Honda",
    model: "Pop",
    yearModel: 2024,
    km: 0,
    transmission: "",
    version: "100",
    price: 8000,
  });
  assert.equal(zero.facts.find((fact) => fact.label === "Km")?.value, "0 km");
  assert.equal(zero.facts.find((fact) => fact.label === "Câmbio"), undefined);

  const missing = publicCardFacts({
    brand: "Fiat",
    model: "Uno",
    yearModel: null,
    km: undefined,
    transmission: null,
    version: null,
    price: null,
    locationCity: "",
  });
  assert.deepEqual(missing.facts, []);
  assert.equal(missing.priceLabel, "");

  const negative = publicCardFacts({
    brand: "Fiat",
    model: "Uno",
    km: -10,
    yearModel: 2012,
    transmission: "Manual",
    price: -1,
  });
  assert.equal(negative.facts.find((fact) => fact.label === "Km"), undefined);
  assert.equal(negative.priceLabel, "");
});

test("câmbio citado na versão entra no fato; campo vazio sem pista não cria câmbio", () => {
  const fromVersion = publicCardFacts({
    brand: "Fiat",
    model: "Pulse",
    version: "Drive 1.3 Flex Automatico",
    yearModel: 2023,
    km: 63000,
    transmission: "",
    locationCity: "linhares",
    price: 89900,
  });
  assert.equal(fromVersion.version, "Drive 1.3 Flex");
  assert.equal(
    fromVersion.facts.find((fact) => fact.label === "Câmbio")?.value,
    "Automático",
  );

  const none = publicCardFacts({
    brand: "Fiat",
    model: "Mobi",
    version: "Like 1.0 Fire",
    yearModel: 2024,
    km: 1000,
    transmission: "",
    price: 50000,
  });
  assert.equal(none.facts.find((fact) => fact.label === "Câmbio"), undefined);
});

test("card público não ganha selo de consignado nem laudo", () => {
  const card = publicCardFacts({
    ...hrv,
    consigned: true,
    inspection: "Cautelar aprovado",
  } as Parameters<typeof publicCardFacts>[0]);
  const text = [card.title, card.version, card.priceLabel, ...card.facts.map((fact) => fact.value)].join(" ");
  assert.doesNotMatch(text, /Consignado/i);
  assert.doesNotMatch(text, /laudo|cautelar|vistoria/i);

  const source = readSrc("components/site/VehicleCard.tsx");
  const css = readSrc("app/globals.css");
  const factCss = css.slice(
    css.indexOf(".vehicle-card-facts {"),
    css.indexOf(".card-open-label {"),
  );
  assert.match(source, /publicCardFacts/);
  assert.match(source, /vehicle-card-fact/);
  assert.match(factCss, /overflow-wrap:\s*normal/);
  assert.match(factCss, /word-break:\s*normal/);
  assert.match(factCss, /grid-template-rows:\s*1rem 1rem/);
  assert.match(factCss, /vehicle-card-fact-line-main/);
  assert.match(factCss, /vehicle-card-fact-line-sub/);
  assert.match(factCss, /white-space:\s*nowrap/);
  assert.match(factCss, /height:\s*1rem/);
  assert.match(factCss, /background:\s*transparent/);
  assert.match(source, /vehicle-card-fact-line-main/);
  assert.match(source, /vehicle-card-title/);
  assert.doesNotMatch(factCss, /-webkit-line-clamp|flex-wrap:\s*wrap/);
  assert.doesNotMatch(factCss, /8\.75rem|2\.125rem|height:\s*1\.5rem/);
  assert.doesNotMatch(factCss, /anywhere|break-all|break-word/);
  assert.doesNotMatch(source, /overflow-wrap:anywhere/);
  assert.doesNotMatch(source, /Consignado/);
  assert.doesNotMatch(source, /"—"/);
  assert.doesNotMatch(source, /laudo|Cautelar|inspection/i);
});

test("o card padrão segue sem WhatsApp ou data; o estoque mobile permite interesse", () => {
  const list = readSrc("components/site/StockInfiniteList.tsx");
  const browse = readSrc("components/site/EstoqueBrowse.tsx");
  const home = readSrc("app/(site)/page.tsx");
  const favorites = readSrc("components/site/FavoritesList.tsx");
  const card = readSrc("components/site/VehicleCard.tsx");
  const button = readSrc("components/site/VehicleCardWhatsApp.tsx");

  assert.match(list, /HideStockCardInterest/);
  assert.match(browse, /HideStockCardInterest/);
  assert.match(card, /StockVehicleLink/);
  assert.match(card, /card-open-label/);
  assert.match(card, /text-brand/);
  assert.match(card, /appearance="ghost"/);
  assert.match(card, /size="sm"/);
  assert.match(card, /vehicle-card-fact/);
  assert.match(card, /label: "Versão"/);
  assert.doesNotMatch(card, /mt-auto/);
  assert.doesNotMatch(card, /VehicleCardWhatsApp/);
  assert.doesNotMatch(card, /formatUpdatedAt/);
  assert.doesNotMatch(card, /Atualizado em/);
  assert.match(button, /useHideStockCardInterest/);
  assert.match(button, /if \(hideOnStockList && !chat && !showOnStockList\) return null/);

  assert.doesNotMatch(home, /HideStockCardInterest/);
  assert.doesNotMatch(favorites, /HideStockCardInterest/);
  assert.match(home, /<VehicleGrid/);
  assert.match(favorites, /<VehicleGrid/);
  assert.match(favorites, /Enviar minha lista no WhatsApp/);
});

function sampleVehicle(overrides: Record<string, unknown> = {}) {
  return {
    id: "hrv-2016",
    category: "carro",
    brand: "Honda",
    model: "HR-V",
    version: "EXL 1.8 Flexone",
    yearModel: 2016,
    km: 103000,
    price: 84900,
    transmission: "Automático",
    fuel: "Flex",
    status: "disponivel",
    featured: false,
    color: "Prata",
    locationCity: "linhares",
    updatedAt: null,
    photos: [{ url: "https://example.com/hrv.jpg" }],
    ...overrides,
  };
}

test("chip longo ganha reticências no fim da palavra", () => {
  assert.equal(clipChipText("Automático"), "Automático");
  assert.equal(clipChipText("Semi-automático"), "Semi-automático");
  assert.equal(clipChipText("101.000 km"), "101.000 km");
  assert.equal(clipChipText("Dynamique 2.0 Tech Road 2", 68), "Dynamique…");
  assert.equal(clipChipText("Comfort Plus", 68), "Comfort Plus");
  assert.doesNotMatch(clipChipText("Dynamique 2.0 Tech Road 2", 68), /Roa|2\.0/);
});

test("o card padrão leva à ficha e não mostra Tenho interesse", () => {
  const vehicle = sampleVehicle();
  const onStock = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(
        HideStockCardInterest,
        null,
        createElement(VehicleCard, { vehicle }),
      ),
    ),
  );
  assert.match(onStock, /Honda HR-V/);
  assert.match(onStock, /EXL 1\.8 Flexone/);
  assert.match(onStock, /R\$\s*84\.900/);
  assert.match(onStock, />2016</);
  assert.match(onStock, /103\.000 km/);
  assert.match(onStock, /Automático/);
  assert.match(onStock, /Linhares/);
  assert.match(onStock, /\/estoque\/honda-hr-v/);
  assert.match(onStock, /Ver ficha/);
  assert.match(onStock, /card-open-label/);
  assert.match(onStock, /vehicle-card-fact/);
  assert.match(onStock, /text-brand/);
  assert.match(onStock, /h-11 w-11/);
  const facts = onStock.slice(
    onStock.indexOf("vehicle-card-facts"),
    onStock.indexOf("vehicle-card-price"),
  );
  assert.match(facts, /EXL 1\.8 Flexone/);
  assert.match(facts, />2016</);
  assert.match(facts, /103\.000 km/);
  assert.match(facts, /Automático/);
  assert.match(facts, /Linhares/);
  assert.doesNotMatch(onStock, /Tenho interesse/);
  assert.doesNotMatch(onStock, /Consignado/);
  assert.doesNotMatch(onStock, /wa\.me/);
  assert.doesNotMatch(onStock, /Atualizado/);

  const elsewhere = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleCard, {
        vehicle: sampleVehicle({ updatedAt: "2026-03-01T12:00:00.000Z", featured: true }),
        showDestaque: true,
      }),
    ),
  );
  assert.match(elsewhere, /Honda HR-V/);
  assert.match(elsewhere, /Ver ficha/);
  assert.match(elsewhere, /Destaque/);
  assert.doesNotMatch(elsewhere, /Tenho interesse/);
  assert.doesNotMatch(elsewhere, /wa\.me/);
  assert.doesNotMatch(elsewhere, /Atualizado/);
});

test("estoque mobile mantém versão e ano completos e restaura interesse no WhatsApp oficial", () => {
  const html = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(
        HideStockCardInterest,
        null,
        createElement(VehicleCard, {
          vehicle: sampleVehicle({
            model: "Civic",
            version: "LXR 2.0 FlexOne",
            yearModel: 2015,
            km: 106000,
            price: 74900,
          }),
          largePhoto: true,
        }),
      ),
    ),
  );
  const mobile = html.slice(html.indexOf('class="stock-mobile-details"'));
  assert.match(mobile, />LXR 2\.0 FlexOne</);
  assert.match(mobile, />2015</);
  assert.match(mobile, /106\.000 km/);
  assert.match(mobile, /Automático/);
  assert.match(mobile, /Linhares/);
  assert.match(mobile, /R\$\s*74\.900/);
  assert.match(mobile, /href="https:\/\/wa\.me\/5527996330706\?/);
  assert.match(mobile, />Tenho interesse<\/a>/);
  assert.ok(mobile.indexOf("Ver ficha") < mobile.indexOf("Tenho interesse"));
  assert.doesNotMatch(mobile, /…|Atualizado em|99956/);
});

test("fato ausente não aparece no HTML do card", () => {
  const html = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(
        HideStockCardInterest,
        null,
        createElement(VehicleCard, {
          vehicle: sampleVehicle({
            version: null,
            yearModel: 0,
            km: null,
            transmission: "",
            locationCity: "aracruz",
            price: 0,
          }),
        }),
      ),
    ),
  );
  assert.match(html, /Honda HR-V/);
  assert.doesNotMatch(html, /R\$ 0/);
  assert.doesNotMatch(html, />Ano</);
  assert.doesNotMatch(html, />Km</);
  assert.doesNotMatch(html, />Câmbio</);
  assert.doesNotMatch(html, />Cidade</);
  assert.doesNotMatch(html, /—/);
  assert.doesNotMatch(html, /Linhares|Aracruz|Serra/);
});

test("o card não mostra Atualizado em, o preço tem glow suave e o coração fica no canto da foto", () => {
  const html = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleCard, {
        vehicle: sampleVehicle({ updatedAt: "2026-10-01T12:00:00.000Z" }),
        largePhoto: true,
      }),
    ),
  );
  assert.match(html, /text-brand/);
  assert.match(html, /R\$\s*84\.900/);
  assert.match(html, /aspect-\[4\/3\]/);
  assert.match(html, />2016</);
  assert.match(html, /103\.000 km/);
  assert.match(html, /Automático/);
  assert.match(html, /Linhares/);
  assert.doesNotMatch(html, /Atualizado/);
  assert.doesNotMatch(html, /bg-asphalt\/70/);
  assert.match(html, /vehicle-card-favorite/);
  assert.match(html, /card-open-label/);
  const photo = html.indexOf("data-vehicle-photo");
  const body = html.indexOf("data-vehicle-body");
  const heart = html.indexOf("nos favoritos");
  assert.ok(photo >= 0 && heart > photo && body > heart);
  const css = readSrc("app/globals.css");
  const priceCss = css.slice(
    css.indexOf(".vehicle-card-price {"),
    css.indexOf(".vehicle-card-favorite {"),
  );
  assert.match(priceCss, /text-shadow/);
  assert.doesNotMatch(priceCss, /0 0 (?:40|48|60|80)px/);
  const buttonCss = css.slice(css.indexOf(".card-open-label {"), css.indexOf(".card-open-label {") + 500);
  assert.match(buttonCss, /border:\s*1px solid/);
  assert.match(buttonCss, /width:\s*100%/);
  assert.match(buttonCss, /justify-content:\s*center/);

  const card = readSrc("components/site/VehicleCard.tsx");
  const grid = readSrc("components/site/VehicleGrid.tsx");
  const home = readSrc("app/(site)/page.tsx");
  const stock = readSrc("components/site/StockInfiniteList.tsx");
  const similar = readSrc("app/(site)/estoque/[id]/page.tsx");
  assert.doesNotMatch(card, /formatUpdatedAt/);
  assert.doesNotMatch(card, /absolute right-1\.5 top-1\.5/);
  assert.match(grid, /largePhoto=\{stock\}/);
  assert.match(grid, /return "grid-cols-2 lg:grid-cols-3"/);
  assert.doesNotMatch(grid, /grid-cols-1 sm:grid-cols-2/);
  assert.match(grid, /-mx-2 w-\[calc\(100%\+1rem\)\] gap-2 sm:mx-0 sm:w-full sm:gap-4/);
  assert.match(grid, /mx-auto w-full gap-3 sm:gap-4/);
  assert.match(
    readSrc("components/site/VehicleCardSkeleton.tsx"),
    /largePhoto\s*\?\s*"-mx-2 w-\[calc\(100%\+1rem\)\] gap-2 sm:mx-0 sm:w-full sm:gap-4"/,
  );
  assert.match(stock, /photoLayout="stock"/);
  assert.doesNotMatch(home, /photoLayout="stock"/);
  assert.doesNotMatch(similar, /photoLayout="stock"/);
});

test("o chat continua com WhatsApp mesmo dentro da lista", () => {
  const html = renderToStaticMarkup(
    createElement(
      HideStockCardInterest,
      null,
      createElement(VehicleCardWhatsApp, {
        vehicleId: "hrv-2016",
        label: "Honda HR-V 2016",
        value: 84900,
        make: "Honda",
        model: "HR-V",
        year: 2016,
        variant: "chat",
      }),
    ),
  );
  assert.match(html, /WhatsApp/);
  assert.match(html, /wa\.me/);
});
