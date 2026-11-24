import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VehicleCard } from "@/components/site/VehicleCard";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { VehicleMobileBar } from "@/components/site/VehicleMobileBar";
import { FavoritesProvider } from "@/lib/favorites";
import { withWhatsAppOrigin } from "@/lib/lead-origin";
import { trackWhatsAppClick, vehicleFunnelParams } from "@/lib/meta-pixel";
import type { VehicleCardRecord } from "@/lib/stock-query";
import {
  buildWhatsAppCarMessage,
  formatWhatsAppPageOriginTag,
} from "@/lib/whatsapp-car-message";
import { pageWhatsAppHref, pageWhatsAppMessage } from "@/lib/whatsapp-cta";

const SAMPLE_ID = "cmtest0000000000000001abc";

function makeCardVehicle(
  overrides: Partial<VehicleCardRecord> = {},
): VehicleCardRecord {
  return {
    id: SAMPLE_ID,
    category: "carro",
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0 FlexOne",
    yearModel: 2020,
    km: 52000,
    price: 109900,
    transmission: "Automático",
    fuel: "Flex",
    status: "disponivel",
    featured: true,
    color: "Prata",
    createdAt: new Date("2026-10-01T12:00:00.000Z"),
    updatedAt: null,
    photos: [{ url: "/fotos/civic-test.webp" }],
    ...overrides,
  } as VehicleCardRecord;
}

test("buildWhatsAppCarMessage inclui marca/modelo/versão, ano, preço à vista em R$, link absoluto e origem no fim", () => {
  for (const pageOrigin of [
    "card do estoque",
    "ficha",
    "home",
    "barra fixa",
  ] as const) {
    const msg = buildWhatsAppCarMessage({
      id: SAMPLE_ID,
      brand: "Honda",
      model: "Civic",
      version: "EXL 2.0 FlexOne Automático",
      yearModel: 2020,
      price: 109900,
      status: "disponivel",
      pageOrigin,
    });

    const lines = msg.split("\n");
    assert.equal(lines.length, 3);
    assert.match(lines[0]!, /Honda Civic EXL 2\.0 FlexOne 2020/);
    assert.match(lines[0]!, /por R\$\s*109\.900/);
    assert.doesNotMatch(
      msg,
      /parcela|entrada|60x|Sua Garagem|loja digital|loja física|pontos de venda|atendimento com hora marcada/i,
    );
    assert.match(
      lines[1]!,
      /^https:\/\/www\.suagaragem\.net\/estoque\/honda-civic-exl-2-0-flexone-automatico-2020-cmtest0000000000000001abc$/,
    );
    assert.equal(lines[2], `[origem: ${pageOrigin}]`);
    assert.ok(msg.endsWith(`[origem: ${pageOrigin}]`));
  }
});

test("buildWhatsAppCarMessage trata veículo reservado e vendido com mensagem adequada", () => {
  const reservedCar = buildWhatsAppCarMessage({
    id: SAMPLE_ID,
    brand: "Toyota",
    model: "Corolla",
    version: "XEi 2.0",
    yearModel: 2021,
    price: 124900,
    status: "reservado",
    pageOrigin: "ficha",
  });
  assert.match(reservedCar, /Toyota Corolla XEi 2\.0 2021/);
  assert.match(reservedCar, /por R\$\s*124\.900 \(reservado\)/);
  assert.match(reservedCar, /fique disponível ou ver opções parecidas/);
  assert.match(
    reservedCar,
    /\nhttps:\/\/www\.suagaragem\.net\/estoque\/toyota-corolla-xei-2-0-2021-cmtest0000000000000001abc\n\[origem: ficha\]$/,
  );

  const reservedMoto = buildWhatsAppCarMessage({
    id: SAMPLE_ID,
    brand: "Honda",
    model: "Biz 125",
    version: "EX",
    yearModel: 2023,
    price: 16900,
    status: "reservado",
    category: "moto",
    pageOrigin: "card do estoque",
  });
  assert.match(reservedMoto, /Vi a Honda Biz 125 EX 2023 por R\$\s*16\.900 \(reservada\)/);
  assert.ok(reservedMoto.endsWith("[origem: card do estoque]"));

  const soldCar = buildWhatsAppCarMessage({
    id: SAMPLE_ID,
    brand: "Toyota",
    model: "Corolla",
    version: "XEi 2.0",
    yearModel: 2021,
    price: 124900,
    status: "vendido",
    pageOrigin: "ficha",
  });
  assert.match(soldCar, /Toyota Corolla XEi 2\.0 2021 já foi vendido/);
  assert.match(soldCar, /opções parecidas no estoque/);
  assert.doesNotMatch(soldCar, /R\$|124\.900|124900/);
  assert.match(
    soldCar,
    /\nhttps:\/\/www\.suagaragem\.net\/estoque\/toyota-corolla-xei-2-0-2021-cmtest0000000000000001abc\n\[origem: ficha\]$/,
  );

  const soldMoto = buildWhatsAppCarMessage({
    id: SAMPLE_ID,
    brand: "Honda",
    model: "Biz 125",
    yearModel: 2023,
    price: 16900,
    sold: true,
    isMoto: true,
    pageOrigin: "vendidos",
  });
  assert.match(soldMoto, /já foi vendida/);
  assert.doesNotMatch(soldMoto, /R\$|16\.900/);
  assert.ok(soldMoto.endsWith("[origem: vendidos]"));
});

test("formatWhatsAppPageOriginTag normaliza colchetes duplicados e espaços", () => {
  assert.equal(formatWhatsAppPageOriginTag("card do estoque"), "[origem: card do estoque]");
  assert.equal(formatWhatsAppPageOriginTag("  [origem: home]  "), "[origem: home]");
  assert.equal(formatWhatsAppPageOriginTag(""), "[origem: site]");
});

test("buildWhatsAppCarMessage convive com withWhatsAppOrigin mantendo link isolado e [origem: ...] no fim", () => {
  const base = buildWhatsAppCarMessage({
    id: SAMPLE_ID,
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0",
    yearModel: 2020,
    price: 109900,
    pageOrigin: "ficha",
  });
  const enriched = withWhatsAppOrigin(base, "instagram");
  const lines = enriched.split("\n");
  assert.equal(lines.length, 3);
  assert.match(lines[0]!, /Civic[^\n]*Vim pelo Instagram\.$/);
  assert.match(lines[1]!, /^https:\/\/www\.suagaragem\.net\/estoque\//);
  assert.equal(lines[2], "[origem: ficha]");
  assert.equal(withWhatsAppOrigin(enriched, null), base);
});

test("cards no estoque e na home têm botão Tenho interesse fora da foto e fora do link da ficha, com origem certa", () => {
  const vehicle = makeCardVehicle();

  const stockHtml = renderToStaticMarkup(
    createElement(FavoritesProvider, null, createElement(VehicleCard, { vehicle })),
  );
  const homeHtml = renderToStaticMarkup(
    createElement(
      FavoritesProvider,
      null,
      createElement(VehicleGrid, { vehicles: [vehicle], pageOrigin: "home" }),
    ),
  );

  // Não aninha <a> dentro de <a> e não cobre a foto (.listing-card-photo)
  const mainLink = stockHtml.match(/<a[^>]*data-stock-card[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? "";
  assert.ok(mainLink.length > 0);
  assert.doesNotMatch(mainLink, /<a\b|Tenho interesse|wa\.me/);
  const photoDiv = stockHtml.match(/<div[^>]*data-vehicle-photo[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
  assert.doesNotMatch(photoDiv, /Tenho interesse|wa\.me/);

  // Acessibilidade e mensagem no card do estoque
  const stockWaHref = stockHtml.match(/href="(https:\/\/wa\.me\/5527996330706\?[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  assert.ok(stockWaHref);
  assert.match(stockHtml, /aria-label="Tenho interesse em Honda Civic EXL 2\.0 FlexOne 2020 pelo WhatsApp"/);
  assert.match(stockWaHref, /utm_campaign=estoque-civic\b/);
  const stockText = new URL(stockWaHref).searchParams.get("text") ?? "";
  assert.match(stockText, /Honda Civic EXL 2\.0 FlexOne 2020/);
  assert.match(stockText, /R\$\s*109\.900/);
  assert.match(stockText, /https:\/\/www\.suagaragem\.net\/estoque\//);
  assert.ok(stockText.endsWith("[origem: card do estoque]"));

  // Mensagem e campanha na home
  const homeWaHref = homeHtml.match(/href="(https:\/\/wa\.me\/5527996330706\?[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  assert.ok(homeWaHref);
  assert.match(homeWaHref, /utm_campaign=home-civic\b/);
  const homeText = new URL(homeWaHref).searchParams.get("text") ?? "";
  assert.match(homeText, /Honda Civic EXL 2\.0 FlexOne 2020/);
  assert.match(homeText, /R\$\s*109\.900/);
  assert.match(homeText, /https:\/\/www\.suagaragem\.net\/estoque\//);
  assert.ok(homeText.endsWith("[origem: home]"));

  // stopPropagation garantido no atalho do card
  const cardWaSrc = readFileSync(
    join(process.cwd(), "src/components/site/VehicleCardWhatsApp.tsx"),
    "utf8",
  );
  assert.match(cardWaSrc, /event\.stopPropagation\(\)/);
});

test("barra fixa no celular na ficha e header/float levam dados completos, link absoluto e origem", () => {
  const barHtml = renderToStaticMarkup(
    createElement(VehicleMobileBar, {
      vehicleId: SAMPLE_ID,
      vehicleSlug: `honda-civic-exl-2-0-flexone-2020-${SAMPLE_ID}`,
      vehiclePath: `/estoque/honda-civic-exl-2-0-flexone-2020-${SAMPLE_ID}`,
      contentName: "Honda Civic EXL 2.0 FlexOne 2020",
      brand: "Honda",
      model: "Civic",
      version: "EXL 2.0 FlexOne",
      status: "disponivel",
      year: 2020,
      price: 109900,
    }),
  );
  const barHref = barHtml.match(/href="(https:\/\/wa\.me\/5527996330706\?[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  assert.ok(barHref);
  assert.match(barHref, /utm_campaign=ficha-civic\b/);
  const barText = new URL(barHref).searchParams.get("text") ?? "";
  assert.match(barText, /Honda Civic EXL 2\.0 FlexOne 2020/);
  assert.match(barText, /R\$\s*109\.900/);
  assert.match(barText, /https:\/\/www\.suagaragem\.net\/estoque\/honda-civic/);
  assert.ok(barText.endsWith("[origem: barra fixa]"));

  const fichaCtx = {
    id: SAMPLE_ID,
    label: "Honda Civic",
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0 FlexOne",
    year: 2020,
    price: 109900,
    status: "reservado",
    path: `/estoque/honda-civic-exl-2-0-flexone-2020-${SAMPLE_ID}`,
    category: "carro",
  };
  const headerMsg = pageWhatsAppMessage(fichaCtx, fichaCtx.path);
  assert.match(headerMsg, /por R\$\s*109\.900 \(reservado\)/);
  assert.match(headerMsg, /https:\/\/www\.suagaragem\.net\/estoque\/honda-civic/);
  assert.ok(headerMsg.endsWith("[origem: ficha]"));

  const headerHref = pageWhatsAppHref({ pathname: fichaCtx.path, vehicle: fichaCtx });
  assert.match(headerHref, /utm_campaign=ficha-civic\b/);
});

test("tracking de clique envia apenas IDs do carro e origem curta — nunca texto livre", () => {
  const params = vehicleFunnelParams({
    vehicleId: SAMPLE_ID,
    slug: `honda-civic-${SAMPLE_ID}`,
    pageOrigin: "card do estoque",
  });
  assert.equal(params.vehicle_id, SAMPLE_ID);
  assert.equal(params.page_origin, "card do estoque");
  assert.equal("message" in params, false);
  assert.equal("text" in params, false);
  assert.doesNotThrow(() =>
    trackWhatsAppClick("vehicle-card", {
      vehicleId: SAMPLE_ID,
      slug: `honda-civic-${SAMPLE_ID}`,
      pageOrigin: "card do estoque",
    }),
  );
});
