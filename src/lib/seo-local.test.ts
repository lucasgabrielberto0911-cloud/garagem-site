import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { VEHICLE_SEO_LOCATION, VEHICLE_SEO_TITLE_MAX } from "./vehicle-seo";
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
  assert.equal(VEHICLE_SEO_LOCATION, SEO_LOCAL_LOCATION);
});

test("título da home foca no norte do ES e cabe na busca", () => {
  assert.equal(
    HOME_SEO_TITLE,
    "Garagem | Seminovos com procedência no norte do ES",
  );
  assert.ok(HOME_SEO_TITLE.length <= VEHICLE_SEO_TITLE_MAX, HOME_SEO_TITLE);
});

test("título do estoque termina em | Garagem uma vez só", () => {
  assert.equal(ESTOQUE_SEO_TITLE, "Carros e motos seminovos em Linhares/ES | Garagem");
  assert.equal(ESTOQUE_SEO_TITLE.split("| Garagem").length - 1, 1);
  assert.doesNotMatch(ESTOQUE_SEO_TITLE, /Sua Garagem/);
  assert.ok(ESTOQUE_SEO_TITLE.length <= VEHICLE_SEO_TITLE_MAX, ESTOQUE_SEO_TITLE);
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
  for (const cidade of ["Linhares", "Colatina", "São Mateus", "Aracruz", "Sooretama"]) {
    assert.ok(HOME_SEO_DESCRIPTION.includes(cidade));
  }
  assert.match(estoque, /title: ESTOQUE_SEO_TITLE/);
  assert.doesNotMatch(estoque, /title: `Estoque \|/);
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
