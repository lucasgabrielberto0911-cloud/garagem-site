import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { HideStockCardInterest } from "@/components/site/HideStockCardInterest";
import { VehicleCard } from "@/components/site/VehicleCard";
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
  assert.match(source, /publicCardFacts/);
  assert.match(source, /whitespace-nowrap/);
  assert.doesNotMatch(source, /overflow-wrap:anywhere/);
  assert.doesNotMatch(source, /Consignado/);
  assert.doesNotMatch(source, /"—"/);
  assert.doesNotMatch(source, /laudo|Cautelar|inspection/i);
});

test("o card não tem WhatsApp nem data de atualização; o chat continua", () => {
  const list = readSrc("components/site/StockInfiniteList.tsx");
  const browse = readSrc("components/site/EstoqueBrowse.tsx");
  const home = readSrc("app/(site)/page.tsx");
  const favorites = readSrc("components/site/FavoritesList.tsx");
  const card = readSrc("components/site/VehicleCard.tsx");
  const button = readSrc("components/site/VehicleCardWhatsApp.tsx");

  assert.match(list, /HideStockCardInterest/);
  assert.match(browse, /HideStockCardInterest/);
  assert.match(card, /StockVehicleLink/);
  assert.match(card, /justify-center/);
  assert.match(card, /text-brand/);
  assert.match(card, /appearance="ghost"/);
  assert.match(card, /\["Ano", "Km"\]/);
  assert.match(card, /\["Câmbio", "Cidade"\]/);
  assert.doesNotMatch(card, /VehicleCardWhatsApp/);
  assert.doesNotMatch(card, /formatUpdatedAt/);
  assert.doesNotMatch(card, /Atualizado em/);
  assert.match(button, /useHideStockCardInterest/);
  assert.match(button, /if \(hideOnStockList && !chat\) return null/);

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

test("o card do estoque leva à ficha e não mostra Tenho interesse", () => {
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
  assert.match(onStock, /justify-center/);
  assert.match(onStock, /text-brand/);
  assert.match(onStock, /h-11 w-11/);
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
