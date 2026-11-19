import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ESTOQUE_SEO_TITLE,
  HOME_SEO_TITLE,
  HOME_SEO_DESCRIPTION,
  SEO_LOCAL_CITY,
  SEO_LOCAL_LOCATION,
} from "./seo-local";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

test("região de busca local tem um ponto só e é Linhares/ES", () => {
  assert.equal(SEO_LOCAL_CITY, "Linhares");
  assert.equal(SEO_LOCAL_LOCATION, "Linhares/ES");
});

const FORBIDDEN_TERMS = [
  /loja digital/i,
  /loja física/i,
  /pontos de venda/i,
  /atendimento com hora marcada/i,
  /Sua Garagem/,
];

test("título da home inclui Linhares, Aracruz e Grande Vitória e cabe na busca", () => {
  assert.equal(
    HOME_SEO_TITLE,
    "Garagem | Seminovos em Linhares, Aracruz e Grande Vitória",
  );
  assert.ok(HOME_SEO_TITLE.length <= 60, HOME_SEO_TITLE);
  for (const regiao of ["Linhares", "Aracruz", "Grande Vitória"]) {
    assert.ok(HOME_SEO_TITLE.includes(regiao), regiao);
  }
  assert.doesNotMatch(HOME_SEO_TITLE, /norte do ES/i);
  for (const pattern of FORBIDDEN_TERMS) {
    assert.doesNotMatch(HOME_SEO_TITLE, pattern);
  }
});

test("título do estoque termina em | Garagem uma vez só", () => {
  assert.equal(ESTOQUE_SEO_TITLE, "Carros e motos seminovos em Linhares/ES | Garagem");
  assert.equal(ESTOQUE_SEO_TITLE.split("| Garagem").length - 1, 1);
  assert.doesNotMatch(ESTOQUE_SEO_TITLE, /Sua Garagem/);
  assert.ok(ESTOQUE_SEO_TITLE.length <= 60, ESTOQUE_SEO_TITLE);
});

test("home usa SEO regional e estoque mantém a região local centralizada", () => {
  const home = readSrc("app/(catalog)/page.tsx");
  const estoque = readSrc("app/(catalog)/estoque/page.tsx");

  for (const source of [home, estoque]) {
    assert.doesNotMatch(source, /Linhares\/ES/);
    assert.doesNotMatch(source, /Sua Garagem/);
  }
  assert.match(home, /title: HOME_SEO_TITLE/);
  assert.match(home, /description: HOME_SEO_DESCRIPTION/);
  assert.match(estoque, /SEO_LOCAL_LOCATION/);
  assert.ok(HOME_SEO_DESCRIPTION.length <= 160, HOME_SEO_DESCRIPTION);
  assert.match(
    HOME_SEO_DESCRIPTION,
    /Atendemos Linhares, Aracruz e Grande Vitória · Combinamos o atendimento pelo WhatsApp/,
  );
  for (const pattern of FORBIDDEN_TERMS) {
    assert.doesNotMatch(HOME_SEO_DESCRIPTION, pattern);
  }
  assert.match(estoque, /title: ESTOQUE_SEO_TITLE/);
  assert.doesNotMatch(estoque, /title: `Estoque \|/);
});

test("hero da home, /links e keywords destacam Linhares, Aracruz e Grande Vitória", () => {
  const home = readSrc("app/(catalog)/page.tsx");
  const hero = home.slice(home.indexOf("hero-red-black"), home.indexOf('id="destaques"'));
  const links = readSrc("app/links/page.tsx");
  const layout = readSrc("app/layout.tsx");

  assert.match(hero, /<h1[^>]*>\s*Seminovos com procedência\. Atendemos Linhares, Aracruz e Grande Vitória\.\s*<\/h1>/);
  assert.doesNotMatch(hero, /todo o norte do ES/i);

  assert.match(
    links,
    /Atendemos Linhares, Aracruz e Grande Vitória · Combinamos o atendimento pelo WhatsApp/,
  );
  assert.doesNotMatch(links, /no norte do ES/i);

  const keywordsBlock = /keywords:\s*\[([\s\S]*?)\]/.exec(layout)?.[1] ?? "";
  assert.ok(keywordsBlock.length > 0, "bloco keywords presente em layout.tsx");
  for (const keyword of [
    "Grande Vitória",
    "Vitória",
    "Vila Velha",
    "Serra",
    "Cariacica",
    "Linhares",
    "Aracruz",
  ]) {
    assert.match(keywordsBlock, new RegExp(`"${keyword}"`), keyword);
  }

  for (const text of [hero, links]) {
    for (const pattern of FORBIDDEN_TERMS) {
      assert.doesNotMatch(text, pattern);
    }
  }
});

test("intro do /estoque fica visível no celular, só compacta", () => {
  const css = readSrc("app/globals.css");
  const rule = /\.stock-compact-opening header > p:last-child:not\(:first-child\):not\(\.font-display\) \{([^}]*)\}/.exec(css);
  assert.ok(rule, "regra da intro no celular");
  assert.doesNotMatch(rule[1], /display:\s*none/);
  // Nenhuma regra do estoque pode esconder a intro (p:last-child do cabeçalho).
  for (const m of css.matchAll(/([^{}]*header > p:last-child[^{]*)\{([^}]*)\}/g)) {
    if (/stock-(page|compact-opening)/.test(m[1])) assert.doesNotMatch(m[2], /display:\s*none/, m[1].trim());
  }
  const estoque = readSrc("app/(catalog)/estoque/page.tsx");
  assert.match(estoque, /description=\{`Seminovos revisados e com garantia em \$\{SEO_LOCAL_LOCATION\}/);
});
