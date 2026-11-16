import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import { MAX_PRICE_OPTIONS } from "@/components/site/StockFilterControls";

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
});

test("StockFilters simplifica atalhos para os 6 chips compactos e mantém filtros completos e dvh", () => {
  const filtersSrc = readSrc("components/site/StockFilters.tsx");
  for (const label of ["Carros", "Motos", "SUV", "Automático", "Manual", "Até R$ 60 mil"]) {
    assert.ok(filtersSrc.includes(`label: "${label}"`), `falta o atalho ${label}`);
  }
  assert.doesNotMatch(filtersSrc, /\.\.\.BUDGET_CHIPS\.map/);
  assert.doesNotMatch(filtersSrc, /\.\.\.STOCK_BODY_OPTIONS\.map/);
  assert.match(filtersSrc, /id="desktop-cambio"/);
  assert.match(filtersSrc, /88dvh/);
  assert.match(filtersSrc, /safe-area-inset-top/);
  assert.ok(MAX_PRICE_OPTIONS.some((item) => item.value === "60000"));
});

test("PWA standalone, hero mobile e botões do assistente respeitam safe-area, dvh e reduced-motion", () => {
  const layout = readSrc("app/layout.tsx");
  assert.match(layout, /viewportFit:\s*"cover"/);

  const polishCss = readSrc("app/(site)/site-polish.css");
  assert.match(polishCss, /@media \(display-mode: standalone\)/);
  assert.match(polishCss, /100dvh/);
  assert.match(polishCss, /safe-area-inset-top/);
  assert.match(polishCss, /safe-area-inset-bottom/);
  assert.match(polishCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(polishCss, /\.site-chat-launcher::after/);

  const headerSrc = readSrc("components/site/SiteHeader.tsx");
  assert.match(headerSrc, /pl-safe pr-safe/);
  assert.match(headerSrc, /100dvh/);

  const deferredChat = readSrc("components/site/DeferredSiteChat.tsx");
  assert.match(deferredChat, /text-white/);
  assert.match(deferredChat, /site-chat-launcher/);
});
