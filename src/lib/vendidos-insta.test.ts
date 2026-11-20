import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  INSTA_DELIVERIES_PAGE_SIZE,
  formatInstaAlt,
  formatInstaAriaLabel,
  formatInstaCaption,
  formatInstaMonthYear,
  formatInstaVehicleLabel,
  nextInstaDeliveriesCount,
  sliceInstaDeliveries,
  type InstaDeliveryItem,
} from "./vendidos-insta";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepoFile = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

test("formatInstaMonthYear converte todos os meses em pt-BR sem depender de fuso", () => {
  const expected: [string, string][] = [
    ["2026-01-01", "jan/2026"],
    ["2026-02-28", "fev/2026"],
    ["2026-03-15", "mar/2026"],
    ["2026-04-10", "abr/2026"],
    ["2026-05-01", "mai/2026"],
    ["2026-06-30", "jun/2026"],
    ["2026-07-04", "jul/2026"],
    ["2022-08-23", "ago/2022"],
    ["2026-09-09", "set/2026"],
    ["2026-10-12", "out/2026"],
    ["2026-11-20", "nov/2026"],
    ["2025-12-31", "dez/2025"],
  ];

  for (const [input, out] of expected) {
    assert.equal(formatInstaMonthYear(input), out);
  }
});

test("formatInstaVehicleLabel, formatInstaCaption e formatInstaAlt tratam com/sem modelo e ano", () => {
  const complete: InstaDeliveryItem = {
    id: "Df0qq85Fbu2",
    date: "2026-11-16",
    brand: "Nissan",
    model: "Kicks Sense",
    year: 2024,
    src: "/vendidos-insta/2026-11-16-Df0qq85Fbu2.webp",
    href: "https://www.instagram.com/reel/Df0qq85Fbu2/",
  };
  assert.equal(formatInstaVehicleLabel(complete), "Nissan Kicks Sense 2024");
  assert.equal(formatInstaCaption(complete), "Nissan Kicks Sense 2024");
  assert.equal(formatInstaAlt(complete), "Entrega de Nissan Kicks Sense 2024");
  assert.match(formatInstaAriaLabel(complete), /Nissan Kicks Sense 2024/);
  assert.match(formatInstaAriaLabel(complete), /Instagram/);

  const noYear: InstaDeliveryItem = {
    id: "Df-f5SVkanr",
    date: "2026-11-20",
    brand: "Ford",
    model: "EcoSport",
    year: null,
    src: "/vendidos-insta/2026-11-20-Df-f5SVkanr.webp",
    href: "https://www.instagram.com/reel/Df-f5SVkanr/",
  };
  assert.equal(formatInstaVehicleLabel(noYear), "Ford EcoSport");
  assert.equal(formatInstaCaption(noYear), "Ford EcoSport");
  assert.equal(formatInstaAlt(noYear), "Entrega de Ford EcoSport");

  const noModelWithYear: InstaDeliveryItem = {
    id: "DTuvin_Ec5m",
    date: "2026-01-20",
    brand: "BMW",
    model: null,
    year: 2026,
    src: "/vendidos-insta/2026-01-20-DTuvin_Ec5m.webp",
    href: "https://www.instagram.com/p/DTuvin_Ec5m/",
  };
  assert.equal(formatInstaVehicleLabel(noModelWithYear), null);
  assert.equal(formatInstaCaption(noModelWithYear), "Entregue em jan/2026");
  assert.equal(
    formatInstaAlt(noModelWithYear),
    "Entrega de veículo da Sua Garagem em jan/2026",
  );
  assert.match(formatInstaAriaLabel(noModelWithYear), /jan\/2026/);
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

test("manifesto vendidos-insta.json tem 369 itens válidos, ordenados e com webp local", () => {
  const data = JSON.parse(
    readRepoFile("src/data/vendidos-insta.json"),
  ) as InstaDeliveryItem[];
  assert.equal(data.length, 369);

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
    assert.doesNotMatch(caption, /R\$\s*\d|\bsimul\w*\b|loja digital/i);
  }
});

test("página /vendidos usa 4 colunas no desktop nas três grades e não mostra simular nem preço", () => {
  const pageSrc = readRepoFile("src/app/(site)/vendidos/page.tsx");
  const gridSrc = readRepoFile("src/components/site/InstaDeliveriesGrid.tsx");

  assert.ok(pageSrc.includes("InstaDeliveriesGrid"));
  assert.ok(pageSrc.includes("instaDeliveries.length > 0"));
  assert.doesNotMatch(pageSrc, /lg:grid-cols-3/);
  assert.match(pageSrc, /lg:grid-cols-4/);
  assert.match(gridSrc, /grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4/);

  for (const src of [pageSrc, gridSrc]) {
    assert.doesNotMatch(
      src,
      /\bsimul\w*\b|R\$\s*\d|loja digital|dourad|gold/i,
    );
  }
});
