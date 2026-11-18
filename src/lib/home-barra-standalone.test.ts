import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import { MAX_PRICE_OPTIONS } from "@/components/site/StockFilterControls";
import { StockFilterFields } from "@/components/site/StockFilterFields";

function readSrc(rel: string) {
  return readFileSync(join(process.cwd(), "src", rel), "utf8");
}

test("MobileBottomNav usa Sora nos rótulos, destaque verde do WhatsApp, vermelho da marca e safe-area", () => {
  const html = renderToStaticMarkup(createElement(MobileBottomNav));
  assert.match(html, /data-mobile-bottom-nav/);
  assert.match(html, /backdrop-blur-md/);
  assert.match(html, /font-display/);
  assert.match(html, /#25D366/);
  assert.match(html, /bg-brand/);
  assert.match(html, /safe-area-inset-bottom/);
  assert.match(html, /Início/);
  assert.match(html, /Estoque/);
  assert.match(html, /WhatsApp/);
  assert.doesNotMatch(html, /-mt-5/);
  assert.match(html, /h-14/);
});

test("StockFilters simplifica atalhos na ordem correta e inclui Carroceria sem duplicar faixa na gaveta", () => {
  const filtersSrc = readSrc("components/site/StockFilters.tsx");
  const expectedOrder = ["Até R$ 60 mil", "Automático", "Manual", "Carros", "Motos", "SUV"];
  let lastIndex = -1;
  for (const label of expectedOrder) {
    const idx = filtersSrc.indexOf(`label: "${label}"`);
    assert.ok(idx > lastIndex, `atalho ${label} fora de ordem ou ausente`);
    lastIndex = idx;
  }
  assert.doesNotMatch(filtersSrc, /\.\.\.BUDGET_CHIPS\.map/);
  assert.doesNotMatch(filtersSrc, /\.\.\.STOCK_BODY_OPTIONS\.map/);
  assert.doesNotMatch(filtersSrc, /clipPath|aria-hidden="true".*tabIndex|chipTrackInsets/);
  assert.match(filtersSrc, /id="desktop-carroceria"/);
  assert.match(filtersSrc, /id="desktop-cambio"/);
  assert.match(filtersSrc, /88dvh/);
  assert.match(filtersSrc, /safe-area-inset-top/);
  assert.ok(MAX_PRICE_OPTIONS.some((item) => item.value === "60000"));

  const fieldsSrc = readSrc("components/site/StockFilterFields.tsx");
  assert.doesNotMatch(fieldsSrc, /BUDGET_CHIPS|Faixa de preço/);
  assert.match(fieldsSrc, /STOCK_BODY_OPTIONS/);
  assert.match(fieldsSrc, /label="Carroceria"/);
  assert.equal(typeof StockFilterFields, "function");

  const pendingSrc = readSrc("components/site/StockPending.tsx");
  assert.doesNotMatch(pendingSrc, /lg:overflow-y-auto/);
});

test("PWA standalone, hero mobile e botões do assistente respeitam safe-area, dvh e reduced-motion", () => {
  const layout = readSrc("app/layout.tsx");
  assert.match(layout, /viewportFit:\s*"cover"/);

  const globalsCss = readSrc("app/globals.css");
  assert.match(globalsCss, /@media \(display-mode: standalone\)/);
  assert.match(globalsCss, /100dvh/);
  assert.match(globalsCss, /safe-area-inset-top/);
  assert.match(globalsCss, /safe-area-inset-bottom/);
  assert.match(globalsCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(globalsCss, /\.site-chat-launcher::after/);

  const headerSrc = readSrc("components/site/SiteHeader.tsx");
  assert.match(headerSrc, /pl-safe pr-safe/);
  assert.match(headerSrc, /100dvh/);

  const deferredChat = readSrc("components/site/DeferredSiteChat.tsx");
  assert.match(deferredChat, /SiteSupportFloat/);
  const supportFloat = readSrc("components/site/SiteSupportFloat.tsx");
  assert.match(supportFloat, /text-white/);
  assert.match(supportFloat, /site-chat-launcher/);
  assert.match(supportFloat, /Falar no WhatsApp/);
  assert.match(supportFloat, /Tirar dúvida rápida/);
  assert.match(supportFloat, /SiteLeadHit/);
  assert.doesNotMatch(supportFloat, /role="menu"/);
});
