import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InstaDeliveriesGrid } from "@/components/site/InstaDeliveriesGrid";
import {
  INSTA_DELIVERIES_PAGE_SIZE,
  formatInstaAlt,
  formatInstaCaption,
  nextInstaDeliveriesCount,
  sliceInstaDeliveries,
  type InstaDeliveryItem,
} from "./vendidos-insta";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepoFile = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

test("formatInstaCaption e formatInstaAlt formatam modelo, só marca e vazio", () => {
  assert.equal(
    formatInstaCaption({ brand: "Chevrolet", model: "Onix" }),
    "Onix vendido",
  );
  assert.equal(
    formatInstaAlt({ brand: "Chevrolet", model: "Onix" }),
    "Chevrolet Onix vendido pela Sua Garagem",
  );

  assert.equal(
    formatInstaCaption({ brand: "Ford", model: "EcoSport" }),
    "EcoSport vendido",
  );
  assert.equal(
    formatInstaCaption({ brand: "Nissan", model: "Kicks Sense" }),
    "Kicks Sense vendido",
  );
  assert.equal(
    formatInstaAlt({ brand: "Nissan", model: "Kicks Sense" }),
    "Nissan Kicks Sense vendido pela Sua Garagem",
  );

  assert.equal(
    formatInstaCaption({ brand: null, model: "Onix" }),
    "Onix vendido",
  );
  assert.equal(
    formatInstaAlt({ brand: null, model: "Onix" }),
    "Onix vendido pela Sua Garagem",
  );

  assert.equal(
    formatInstaCaption({ brand: "BMW", model: null }),
    "BMW vendido",
  );
  assert.equal(
    formatInstaAlt({ brand: "BMW", model: null }),
    "BMW vendido pela Sua Garagem",
  );

  assert.equal(
    formatInstaCaption({ brand: null, model: null }),
    "Vendido",
  );
  assert.equal(
    formatInstaAlt({ brand: null, model: null }),
    "Veículo vendido pela Sua Garagem",
  );
});

test("sliceInstaDeliveries e nextInstaDeliveriesCount paginam de 24 em 24 até o total", () => {
  assert.equal(INSTA_DELIVERIES_PAGE_SIZE, 24);
  const items = Array.from({ length: 60 }, (_, idx) => idx);
  assert.equal(sliceInstaDeliveries(items, 24).length, 24);
  assert.equal(nextInstaDeliveriesCount(24, items.length), 48);
  assert.equal(nextInstaDeliveriesCount(48, items.length), 60);
  assert.equal(nextInstaDeliveriesCount(60, items.length), 60);
  assert.equal(sliceInstaDeliveries(items, 999).length, 60);
  assert.equal(sliceInstaDeliveries(items, -5).length, 0);
});

test("manifesto vendidos-insta.json tem 288 itens válidos, ordenados e com webp local", () => {
  const data = JSON.parse(
    readRepoFile("src/data/vendidos-insta.json"),
  ) as InstaDeliveryItem[];
  assert.equal(data.length, 288);

  const webpFiles = readdirSync(join(repoRoot, "public/vendidos-insta")).filter(
    (name) => name.endsWith(".webp"),
  );
  assert.equal(webpFiles.length, 288);

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    assert.ok(item.id, `id ausente no índice ${i}`);
    assert.match(item.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(item.src, /^\/vendidos-insta\/.+\.webp$/);
    assert.match(item.href, /^https:\/\/www\.instagram\.com\/(?:p|reel|tv)\//);
    assert.ok(
      existsSync(join(repoRoot, "public", item.src)),
      `arquivo ausente: public${item.src}`,
    );
    if (i > 0) {
      assert.ok(
        data[i - 1].date >= item.date,
        `ordem incorreta entre ${data[i - 1].date} e ${item.date}`,
      );
    }
    const caption = formatInstaCaption(item);
    assert.match(caption, /(?:\bvendido|^Vendido)$/);
    assert.doesNotMatch(caption, /R\$\s*\d|\bsimul\w*\b|loja digital|\b\d{4}\b/i);

    const alt = formatInstaAlt(item);
    assert.match(alt, /vendido pela Sua Garagem$/);
  }
});

test("InstaDeliveriesGrid renderiza 24 iniciais, 4 eager, botão Ver mais e some quando acaba", () => {
  const data = JSON.parse(
    readRepoFile("src/data/vendidos-insta.json"),
  ) as InstaDeliveryItem[];

  const fullHtml = renderToStaticMarkup(
    createElement(InstaDeliveriesGrid, { items: data }),
  );
  assert.equal((fullHtml.match(/<li\b/g) ?? []).length, 24);
  assert.equal((fullHtml.match(/loading="eager"/g) ?? []).length, 4);
  assert.equal((fullHtml.match(/loading="lazy"/g) ?? []).length, 20);
  assert.doesNotMatch(fullHtml, /<a\b|instagram\.com|Mostrando/i);
  assert.match(fullHtml, />Ver mais<\/button>/);

  const shortHtml = renderToStaticMarkup(
    createElement(InstaDeliveriesGrid, { items: data.slice(0, 10) }),
  );
  assert.equal((shortHtml.match(/<li\b/g) ?? []).length, 10);
  assert.doesNotMatch(shortHtml, /Ver mais/);
});

test("página /vendidos mantém só a grade de fotos, 4 colunas no desktop e sem seções extras", () => {
  const pageSrc = readRepoFile("src/app/(site)/vendidos/page.tsx");
  const gridSrc = readRepoFile("src/components/site/InstaDeliveriesGrid.tsx");

  assert.ok(pageSrc.includes("InstaDeliveriesGrid"));
  assert.match(pageSrc, /title="Vendidos"/);
  assert.doesNotMatch(
    pageSrc,
    /getSoldShowcaseData|getSiteStats|WantedVehicleCta|Veículos vendidos recentemente|Entregas registradas|Galeria de entregas em atualização/,
  );
  assert.match(gridSrc, /grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4/);
  assert.match(gridSrc, /bg-white\/5/);
  assert.doesNotMatch(gridSrc, /<a\b|Mostrando|instagram\.com/i);

  for (const src of [pageSrc, gridSrc]) {
    assert.doesNotMatch(
      src,
      /\bsimul\w*\b|R\$\s*\d|loja digital|dourad|gold/i,
    );
  }
});
