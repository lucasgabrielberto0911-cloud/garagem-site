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
  assert.match(hero, /href="\/estoque"/);
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
});

test("favoritos: lista no WhatsApp com id, e vazio aponta estoque", () => {
  const list = readSrc("components/site/FavoritesList.tsx");
  assert.match(list, /favoritesListWhatsApp/);
  assert.match(list, /vehicleId=\{pack\.vehicleId\}/);
  assert.match(list, /trackingLabel="favoritos-lista"/);
  assert.match(list, /whatsappCampaign="favoritos"/);
  assert.match(list, /href="\/estoque"/);
  assert.match(list, /trackingLabel="favoritos-vazio"/);
  assert.match(readSrc("lib/favorites.ts"), /garagem:favoritos/);
  assert.match(readSrc("components/site/FavoriteButton.tsx"), /href="\/favoritos"/);
  assert.match(list, /vehicleLocationLabel/);
  assert.match(list, /Cidade/);
});
