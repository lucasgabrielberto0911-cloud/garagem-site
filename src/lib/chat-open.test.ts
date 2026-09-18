import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CHAT_HELP_LABEL } from "./chat-open";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string) {
  return readFileSync(join(srcRoot, rel), "utf8");
}

function chatOpenBlocks(source: string) {
  return source.match(/<ChatOpenButton\b[\s\S]*?\/>/g) ?? [];
}

test("o botão do chat usa exatamente “Ajuda para escolher”, sem “pra”", () => {
  assert.equal(CHAT_HELP_LABEL, "Ajuda para escolher");
  assert.doesNotMatch(CHAT_HELP_LABEL, /(^|[^a-zà-ü])pra([^a-zà-ü]|$)/i);
  assert.match(CHAT_HELP_LABEL, /\bpara\b/);
});

test("ficha: Ajuda para escolher é vermelho sólido, sem fundo asfalto", () => {
  const blocks = chatOpenBlocks(readSrc("app/(site)/estoque/[id]/page.tsx"));
  assert.equal(blocks.length, 2);
  for (const block of blocks) {
    assert.match(block, /variant="solid"/);
    assert.doesNotMatch(block, /bg-asphalt/);
  }
  assert.match(blocks.join("\n"), /source="ficha"/);
  assert.match(blocks.join("\n"), /source="ficha-header"/);
});

test("home não herda o vermelho sólido da ficha", () => {
  const home = chatOpenBlocks(readSrc("app/(site)/page.tsx"));
  assert.ok(home.length >= 1);
  for (const block of home) {
    assert.doesNotMatch(block, /variant="solid"/);
  }
});

test("filtros do estoque não têm faixa inline Ajuda para escolher", () => {
  const filters = readSrc("components/site/StockFilters.tsx");
  assert.equal(chatOpenBlocks(filters).length, 0);
  assert.doesNotMatch(filters, /ChatOpenButton/);
  assert.doesNotMatch(filters, /estoque-filtros/);
});

test("a ficha continua escondendo o FAB fechado para não cobrir a galeria", () => {
  const css = readSrc("app/globals.css");
  assert.match(
    css,
    /body:has\(\[data-vehicle-mobile-bar\]\) \.site-chat:not\(\.is-open\)/,
  );
});

test("mobile com chips de faixa não esconde o FAB fechado", () => {
  const css = readSrc("app/globals.css");
  assert.doesNotMatch(
    css,
    /body:has\(\.chip-scroll\)\s+\.site-chat:not\(\.is-open\)/,
  );
});
