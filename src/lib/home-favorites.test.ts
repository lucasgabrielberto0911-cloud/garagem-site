import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("home: WhatsApp e estoque no hero, chat só no fim e em contorno", () => {
  const page = readSrc("app/(site)/page.tsx");
  const hero = page.slice(page.indexOf("hero-red-black"), page.indexOf('id="destaques"'));
  assert.match(hero, /trackingLabel="home-hero"/);
  assert.match(hero, /Falar no WhatsApp/);
  assert.match(hero, /<ButtonLink href="\/estoque" size="lg"/);
  assert.match(hero, /hero-cta flex w-full shrink-0 flex-col/);
  assert.doesNotMatch(hero, /hero-brand hidden/);
  assert.match(hero, /site\.whatsappLabel/);
  assert.doesNotMatch(hero, /text-xs[\s\S]{0,40}Ver estoque/);
  assert.match(hero, /A gente revisa cada veículo, e ele sai com garantia/);
  assert.match(hero, /A documentação vai 100% preparada, pra você ter mais tranquilidade/);
  assert.doesNotMatch(page, /Checagem de condição antes de entrar no estoque/);
  assert.doesNotMatch(page, /Procedência conferida/);
  assert.doesNotMatch(page, /alinhada na transferência/);
  assert.doesNotMatch(hero, /ChatOpenButton/);
  assert.doesNotMatch(hero, /assistente/);
  assert.match(page, /preload\(HERO_WORDMARK/);
  const chat = page.indexOf("<ChatOpenButton");
  assert.ok(chat > page.indexOf('id="destaques"'));
  assert.match(page.slice(chat, chat + 220), /variant="outline"/);
  assert.match(page.slice(chat, chat + 220), /source="home-final"/);
  assert.match(hero, /hidden w-full max-w-2xl sm:mt-8 sm:block/);
  assert.doesNotMatch(readSrc("components/site/HeroSearch.tsx"), /pb-16/);
  const afterStock = page.slice(page.indexOf("Ver todos os veículos"));
  assert.match(afterStock, /sm:hidden/);
  assert.match(afterStock, /<StatsBar/);
  assert.match(hero, /Seminovos com procedência em \{site\.region\}\./);
  assert.doesNotMatch(hero, /publicSite\.region/);
  assert.match(page, /\(27\) 99633-0706|whatsappLabel/);
  assert.doesNotMatch(page, /99956/);
});

test("home: Instagram no atendimento é atalho, sem rótulo de canais", () => {
  const page = readSrc("app/(site)/page.tsx");
  const start = page.indexOf("6. ATENDIMENTO");
  const end = page.indexOf("7. VENDER OU TROCAR");
  assert.ok(start > 0 && end > start);
  const block = page.slice(start, end);
  assert.doesNotMatch(page, /Canais de contato/i);
  assert.doesNotMatch(block, /Canais de contato/i);
  assert.match(
    block,
    /https:\/\/www\.instagram\.com\/\$\{site\.instagram\.replace\(\/\^@\/, ""\)\}\//,
  );
  assert.match(block, /target="_blank"/);
  assert.match(block, /rel="noopener noreferrer"/);
  assert.match(block, /\{site\.instagram\}/);
  assert.match(block, /IconInstagram/);
  assert.match(block, /min-h-14/);
  assert.match(block, /whatsappLabel/);
  assert.match(block, /Loja digital no \$\{publicSite\.state\}/);
  assert.match(
    block,
    /Atendemos \$\{publicSite\.region\}\. Escolha no site, peça vídeo pelo WhatsApp e combine visita, entrega ou retirada\./,
  );
  assert.match(block, />\s*WhatsApp\s*</);
  assert.match(block, />\s*Horário\s*</);
  assert.match(block, />\s*Modalidade\s*</);
  assert.doesNotMatch(block, /99956/);
  assert.doesNotMatch(block, /Checagem de condição/);
  assert.match(readSrc("lib/site.ts"), /instagram: "@suagaragem1"/);
});

test("favoritos: lista no WhatsApp com id, e vazio aponta estoque", () => {
  const list = readSrc("components/site/FavoritesList.tsx");
  assert.match(list, /favoritesListWhatsApp/);
  assert.match(list, /vehicleId=\{pack\.vehicleId\}/);
  assert.match(list, /trackingLabel="favoritos-lista"/);
  assert.match(list, /Enviar minha lista no WhatsApp/);
  assert.doesNotMatch(list, /whatsappCampaign=/);
  assert.match(list, /href="\/estoque"/);
  assert.match(list, /trackingLabel="favoritos-vazio"/);
  assert.match(readSrc("lib/favorites.ts"), /garagem:favoritos/);
  assert.match(readSrc("components/site/FavoriteButton.tsx"), /href="\/favoritos"/);
  const comparison = readSrc("components/site/FavoritesComparison.tsx");
  assert.doesNotMatch(comparison, /vehicleLocationLabel|Cidade/);
});
