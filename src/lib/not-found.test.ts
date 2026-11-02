import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const rootNotFound = readFileSync("src/app/not-found.tsx", "utf8");
const siteNotFound = readFileSync("src/app/(site)/not-found.tsx", "utf8");
const content = readFileSync("src/components/site/NotFoundContent.tsx", "utf8");

test("root not-found envolve o conteúdo no SiteLayout para garantir header e footer", () => {
  assert.match(rootNotFound, /import SiteLayout from "@\/app\/\(site\)\/layout"/);
  assert.match(rootNotFound, /<SiteLayout>/);
  assert.match(rootNotFound, /<NotFoundContent \/>/);
});

test("(site)/not-found reutiliza NotFoundContent sem duplicar layout", () => {
  assert.match(siteNotFound, /import { NotFoundContent } from "@\/components\/site\/NotFoundContent"/);
  assert.match(siteNotFound, /<NotFoundContent \/>/);
  // O layout do grupo (site) já envolve as rotas filhas, não deve ter SiteLayout duplicado
  assert.doesNotMatch(siteNotFound, /<SiteLayout>/);
});

test("NotFoundContent tem visual do site com Sora nos títulos e Inter no texto", () => {
  // Sora nos títulos (font-display) e cores da loja
  assert.match(content, /font-display text-xs font-semibold uppercase tracking-\[0\.2em\] text-brand-light/);
  assert.match(content, /font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl/);
  assert.match(content, /Página não encontrada/);
  assert.match(content, /bg-brand-gradient/);

  // Texto curto explicativo
  assert.match(content, /text-sm leading-relaxed text-muted/);
  assert.match(content, /O link que você tentou acessar não existe, foi alterado ou o veículo já foi vendido/);
  assert.match(content, /Veja as opções disponíveis no nosso estoque ou fale com a nossa equipe/);

  // Botão principal Ver estoque (/estoque)
  assert.match(content, /<ButtonLink href="\/estoque" size="lg">/);
  assert.match(content, /Ver estoque/);

  // Botão secundário Falar no WhatsApp
  assert.match(content, /<WhatsAppButton size="lg" variant="outline" trackingLabel="404">/);
  assert.match(content, /Falar no WhatsApp/);

  // Link para Início
  assert.match(content, /<Link[\s\S]*href="\/"/);
  assert.match(content, /Voltar para o Início/);
  assert.match(content, /min-h-11/);
  assert.match(content, /touch-manipulation/);
});
