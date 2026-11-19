import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeAssistantButton } from "@/components/site/HomeAssistantCta";
import { LinksHub } from "@/components/site/LinksHub";
import { RealStockPreview } from "@/components/site/RealStockPreview";
import { WhatsAppButton } from "@/components/site/ui";
import { DEFAULT_LINKS } from "@/lib/site-links";
import type { VehicleCardRecord } from "@/lib/stock-query";

function readSrc(rel: string) {
  return readFileSync(join(process.cwd(), "src", rel), "utf8");
}

function sampleVehicle(overrides: Partial<VehicleCardRecord> = {}): VehicleCardRecord {
  return {
    id: "cm0000000000000000000001",
    category: "carro",
    brand: "Honda",
    model: "Civic",
    version: "EXL 2.0 Automático",
    yearModel: 2021,
    km: 48000,
    price: 118900,
    fuel: "Flex",
    transmission: "Automático",
    color: "Prata",
    status: "disponivel",
    featured: true,
    catalog: true,
    createdAt: new Date("2026-10-01T12:00:00Z"),
    updatedAt: new Date("2026-10-02T12:00:00Z"),
    photos: [
      {
        url: "/branding/placeholder-car.png",
        thumbnailUrl: "/branding/placeholder-car.png",
      },
    ],
    ...overrides,
  };
}

test("WhatsAppButton solid usa verde #25D366 com letra branca e alvo >=56px no lg", () => {
  const htmlLg = renderToStaticMarkup(
    createElement(WhatsAppButton, { size: "lg" }, "Falar no WhatsApp"),
  );
  assert.match(htmlLg, /bg-\[#25D366\]/);
  assert.match(htmlLg, /\btext-white\b/);
  assert.match(htmlLg, /min-h-\[56px\]/);
  assert.doesNotMatch(htmlLg, /\bbg-brand\b/);
  assert.doesNotMatch(htmlLg, /\btext-asphalt\b/);
  assert.doesNotMatch(htmlLg, /gold|yellow|#ffd/i);

  const htmlOutline = renderToStaticMarkup(
    createElement(WhatsAppButton, { variant: "outline" }, "Falar no WhatsApp"),
  );
  assert.doesNotMatch(htmlOutline, /bg-\[#25D366\]/);
});

test("HomeAssistantButton permanece vermelho cheio com texto branco e >=56px", () => {
  const html = renderToStaticMarkup(createElement(HomeAssistantButton));
  assert.match(html, /\bbg-brand\b/);
  assert.match(html, /\btext-white\b/);
  assert.match(html, /min-h-\[56px\]/);
  assert.doesNotMatch(html, /#25D366|emerald|green/i);
});

test("LinksHub usa WhatsApp verde #25D366 com texto branco e Estoque vermelho", () => {
  const html = renderToStaticMarkup(
    createElement(LinksHub, { links: DEFAULT_LINKS }),
  );
  assert.match(html, /bg-\[#25D366\] text-white/);
  assert.match(html, /bg-brand text-white/);
  assert.match(html, /min-h-\[58px\]/);
  assert.doesNotMatch(html, /bg-\[#25D366\][^"]*text-asphalt/);
});

test("RealStockPreview renderiza fotos 4:3 com fundo desfocado, sem <ul>/<nav> e sem preço quando vendido", () => {
  const available = sampleVehicle();
  const sold = sampleVehicle({
    id: "cm0000000000000000000002",
    model: "City",
    status: "vendido",
    price: 89900,
  });

  const compactHtml = renderToStaticMarkup(
    createElement(RealStockPreview, {
      vehicles: [available, sold],
      variant: "compact",
    }),
  );
  assert.match(compactHtml, /aspect-\[4\/3\]/);
  assert.match(compactHtml, /blur-2xl/);
  assert.match(compactHtml, /object-contain/);
  assert.match(compactHtml, /118\.900/);
  assert.doesNotMatch(compactHtml, /89\.900/);
  assert.doesNotMatch(compactHtml, /<ul\b|<nav\b/);

  const cardsHtml = renderToStaticMarkup(
    createElement(RealStockPreview, {
      vehicles: [available],
      variant: "cards",
    }),
  );
  assert.match(cardsHtml, /aspect-\[4\/3\]/);
  assert.match(cardsHtml, /blur-2xl/);
  assert.match(cardsHtml, /Automático/);
  assert.match(cardsHtml, /48\.000 km/);
  assert.doesNotMatch(cardsHtml, /Linhares|Aracruz|Vitória/);
});

test("páginas /links, /como-funciona e /financiamento seguem cache, estoque próprio e regras de marca", () => {
  const linksPage = readSrc("app/links/page.tsx");
  const comoFunciona = readSrc("app/(site)/como-funciona/page.tsx");
  const financiamento = readSrc("app/(site)/financiamento/page.tsx");

  for (const [name, src] of [
    ["links", linksPage],
    ["como-funciona", comoFunciona],
    ["financiamento", financiamento],
  ] as const) {
    assert.match(src, /export const revalidate = 3600;/, name);
    assert.match(src, /getFeaturedVehicles\(/, name);
    assert.match(src, /RealStockPreview/, name);
    assert.match(src, /shadow-/, name);
    assert.doesNotMatch(
      src,
      /loja digital|Sua Garagem|gold|#ffd700|simulador|\b\d+\s*cv\b|\bmarchas\b/i,
      name,
    );
  }

  // /links não pode mencionar parcela, financiamento ou simulador (coberto também no e2e).
  assert.doesNotMatch(linksPage, /parcela|financiamento|simulador/i);
  assert.doesNotMatch(linksPage, /<nav\b|<ul\b/);
});
