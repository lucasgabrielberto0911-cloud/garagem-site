import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { HideStockCardInterest } from "@/components/site/HideStockCardInterest";
import { VehicleCard } from "@/components/site/VehicleCard";
import { VehicleGrid } from "@/components/site/VehicleGrid";
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

test("card completo mostra título curto, preço, ano, km e câmbio sem cidade", () => {
  const card = publicCardFacts(hrv);
  assert.equal(card.title, "Honda HR-V");
  assert.equal(card.version, "EXL 1.8 Flexone");
  assert.equal(card.priceLabel.replace(/\u00a0/g, " "), "R$ 84.900");
  assert.deepEqual(
    card.facts.map((fact) => `${fact.label}: ${fact.value}`),
    ["Ano: 2016", "Km: 103.000 km", "Câmbio: Automático"],
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
    locationCity: "guarapari",
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
  assert.doesNotMatch(source, /Consignado|laudo|Cautelar|inspection/i);
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

function renderCard(overrides: Record<string, unknown> = {}, onStock = false) {
  const card = createElement(VehicleCard, { vehicle: sampleVehicle(overrides) });
  return renderToStaticMarkup(createElement(
    FavoritesProvider,
    null,
    onStock ? createElement(HideStockCardInterest, null, card) : card,
  ));
}

test("o card completo tem um link para a ficha e uma ação separada para o WhatsApp", () => {
  const html = renderCard();
  const main = html.match(/<a[^>]*data-stock-card[^>]*>([\s\S]*?)<\/a>/)?.[1];
  assert.ok(main);
  assert.match(main, /data-vehicle-photo/);
  assert.match(main, />Honda</);
  assert.match(main, />HR-V</);
  assert.match(main, /EXL 1\.8 Flexone/);
  assert.match(main, />2016</);
  assert.match(main, /103\.000 km/);
  assert.match(main, /Automático/);
  assert.doesNotMatch(main, /Linhares|Cidade/);
  assert.match(main, /R\$\s*84\.900/);
  assert.match(html, /href="\/estoque\/honda-hr-v/);
  assert.doesNotMatch(main, /Tenho interesse|<button|wa\.me/);
  assert.match(html, /href="https:\/\/wa\.me\/5527996330706\?/);
  assert.match(html, />Tenho interesse<\/a>/);
  assert.doesNotMatch(html, /Ver ficha|Atualizado|Consignado|99956/);
});

test("versão integral e WhatsApp permanecem iguais no estoque e nas outras listas", () => {
  const vehicle = { model: "Duster", version: "Dynamique 2.0 16V Tech Road 2", yearModel: 2014 };
  const stock = renderCard(vehicle, true);
  const standard = renderCard(vehicle);
  assert.equal(stock, standard);
  assert.match(stock, />Dynamique 2\.0 16V Tech Road 2</);
  assert.match(stock, />2014</);
  assert.match(stock, />Tenho interesse<\/a>/);
  assert.doesNotMatch(stock, /…|Ver ficha|Atualizado em/);
});

test("VehicleGrid entrega o mesmo anúncio em todas as listas, sem uma variante para o estoque", () => {
  const renderGrid = (photoLayout: "default" | "stock") => renderToStaticMarkup(
    createElement(FavoritesProvider, null, createElement(VehicleGrid, {
      vehicles: [sampleVehicle()], photoLayout,
    })),
  );
  assert.equal(renderGrid("default"), renderGrid("stock"));
  assert.match(renderGrid("default"), /grid-cols-2/);
  for (const source of [
    "app/(site)/page.tsx",
    "components/site/StockInfiniteList.tsx",
    "components/site/FavoritesList.tsx",
    "components/site/SimilarVehicles.tsx",
  ]) assert.match(readSrc(source), /VehicleGrid/);
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
            locationCity: null,
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

test("o coração é independente do link e o anúncio não mostra data de atualização", () => {
  const html = renderCard({ updatedAt: "2026-10-01T12:00:00.000Z" });
  assert.match(html, /vehicle-card-favorite/);
  assert.match(html, /nos favoritos/);
  assert.match(html, /aspect-\[4\/3\]/);
  assert.doesNotMatch(html, /Atualizado/);
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

test("card não exibe a cidade salva no admin, sem mudar os outros fatos", () => {
  for (const [locationCity] of [
    ["vitoria", "Vitória"],
    ["aracruz", "Aracruz"],
  ]) {
    const card = publicCardFacts({ ...hrv, locationCity });
    assert.equal(card.facts.find((fact) => fact.label === "Cidade"), undefined);
    assert.equal(card.priceLabel, publicCardFacts(hrv).priceLabel);
    assert.equal(card.version, publicCardFacts(hrv).version);
  }
});
