import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeAssistantButton } from "@/components/site/HomeAssistantCta";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("home: hero só com 3 botões grandes, chat só no fim e em contorno", () => {
  const page = readSrc("app/(catalog)/page.tsx");
  const hero = page.slice(page.indexOf("hero-red-black"), page.indexOf('id="destaques"'));
  assert.match(hero, /trackingLabel="home-hero"/);
  assert.match(hero, /Falar no WhatsApp/);
  assert.match(hero, /<ButtonLink[\s\S]{0,120}href="\/estoque"[\s\S]{0,120}variant="outline"/);
  assert.match(hero, /<HomeAssistantButton \/>/);
  // Sem campo de texto, busca, estatísticas nem link solto do assistente.
  assert.doesNotMatch(page, /HomeAssistantAsk|HeroSearch|StatsBar/);
  assert.doesNotMatch(hero, /<input|hero-stats|hero-search/);
  // Três botões com 56px de altura mínima; lado a lado no desktop, empilhados no celular.
  assert.match(hero, /grid-cols-1[^"]*lg:grid-cols-3/);
  assert.equal((hero.match(/!min-h-\[56px\]/g) || []).length, 2);
  assert.doesNotMatch(hero, /hero-brand/);
  assert.doesNotMatch(hero, /<SiteWordmark/);
  assert.doesNotMatch(hero, /ChatOpenButton/);
  assert.doesNotMatch(page, /Checagem de condição antes de entrar no estoque/);
  assert.doesNotMatch(page, /Procedência conferida/);
  assert.doesNotMatch(page, /alinhada na transferência/);
  assert.doesNotMatch(page, /preload\(HERO_WORDMARK/);
  const chat = page.indexOf("<ChatOpenButton");
  assert.ok(chat > page.indexOf('id="destaques"'));
  assert.match(page.slice(chat, chat + 220), /variant="outline"/);
  assert.match(page.slice(chat, chat + 220), /source="home-final"/);
  assert.match(hero, /Seminovos com procedência\. Atendemos Linhares, Aracruz e Grande Vitória\./);
  assert.doesNotMatch(hero, /publicSite\.region/);
  // Destaques sobem logo depois do topo e mostram só a lista de carros.
  const featured = page.slice(page.indexOf('id="destaques"'), page.indexOf("Ver todos os veículos"));
  assert.doesNotMatch(featured, /<HeroSearch|Ex\.: Civic|FAIXA|MARCAS/);
  const rememberSnap = readSrc("components/site/RememberVehicleSnapshot.tsx");
  assert.match(rememberSnap, /queueMicrotask\(/);
  assert.doesNotMatch(rememberSnap, /requestIdleCallback/);
  const comparison = readSrc("components/site/FavoritesComparison.tsx");
  assert.doesNotMatch(comparison, /vehicleLocationLabel|Cidade/);
});

test("assistente da home é um botão vermelho de verdade, de 56px, sem sublinhado nem campo de texto", () => {
  const html = renderToStaticMarkup(createElement(HomeAssistantButton));
  assert.match(html, /^<button type="button"/);
  assert.match(html, />Pergunte ao assistente<\/button>$/);
  assert.match(html, /bg-brand/);
  assert.match(html, /text-white/);
  assert.match(html, /min-h-\[56px\]/);
  assert.match(html, /rounded-xl/);
  assert.match(html, /hover:bg-brand-dark/);
  assert.match(html, /focus-visible:ring-4/);
  assert.match(html, /<svg/);
  assert.doesNotMatch(html, /(?<!no-)underline|<input|<label|bg-brand-gradient/);
});
