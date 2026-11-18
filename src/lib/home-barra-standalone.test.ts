import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";

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
