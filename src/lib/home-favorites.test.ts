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

test("home: hero com pontos pontuais, 3 botões grandes e sem faixa preta sob o header", () => {
  const page = readSrc("app/(catalog)/page.tsx");
  const css = readSrc("app/globals.css");
  const hero = page.slice(page.indexOf("data-home-page"), page.indexOf('id="destaques"'));
  assert.match(page, /<section\s+data-home-page=""\s+className="hero-red-black/);
  assert.match(
    css,
    /body:has\(\[data-home-page\]\) \.pt-site-header \{\s*padding-top: calc\(4\.5rem \+ 1px \+ env\(safe-area-inset-top, 0px\)\);/,
  );
  assert.match(
    css,
    /@media \(min-width: 1024px\) \{[\s\S]{0,260}body:has\(\[data-home-page\]\) \.pt-site-header \{\s*padding-top: calc\(4\.75rem \+ 1px \+ env\(safe-area-inset-top, 0px\)\);/,
  );
  assert.match(hero, /trackingLabel="home-hero"/);
  assert.match(hero, /Falar no WhatsApp/);
  assert.match(hero, /<ButtonLink[\s\S]{0,120}href="\/estoque"[\s\S]{0,120}variant="outline"/);
  assert.match(hero, /<HomeAssistantButton \/>/);
  // Pontos pontuais no hero, entre o H1 e os 3 botões grandes, sem card/borda/sombra nem duplicar TrustBadges.
  const h1Index = hero.indexOf("<h1");
  const highlightsIndex = hero.indexOf("data-hero-highlights");
  const ctaIndex = hero.indexOf("hero-cta");
  assert.ok(h1Index >= 0 && highlightsIndex > h1Index && ctaIndex > highlightsIndex);
  const highlightsBlock = hero.slice(highlightsIndex, ctaIndex);
  assert.doesNotMatch(highlightsBlock, /\bborder\b|\bshadow-/);
  assert.match(highlightsBlock, /\btext-base\b/);
  for (const label of [
    "Garantia de 3 meses motor e câmbio",
    "Vistoria da loja",
    "Aceitamos seu carro na troca",
    "Financiamos em até 60x",
  ]) {
    assert.match(page, new RegExp(label));
  }
  assert.doesNotMatch(page, /\bTrustBadges\b/);
  assert.doesNotMatch(hero, /simul|parcela|loja digital|gold|yellow|#ffc72c|#ffd700/i);
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
