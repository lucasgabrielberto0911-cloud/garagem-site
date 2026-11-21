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
  INSTA_DELIVERY_FADE_FALLBACK_MS,
  buildInstaSrcSet,
  formatInstaAlt,
  formatInstaLabels,
  isValidInstaLqip,
  nextInstaDeliveriesCount,
  sliceInstaDeliveries,
  type InstaDeliveryItem,
} from "./vendidos-insta";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const readRepoFile = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

function readWebpDimensions(filePath: string): { width: number; height: number } | null {
  const buf = readFileSync(filePath);
  if (
    buf.length < 30 ||
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (chunk === "VP8X") {
    return {
      width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
      height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
    };
  }
  return null;
}

test("formatInstaLabels e formatInstaAlt formatam marca+modelo, só modelo, só marca e vazio", () => {
  assert.deepEqual(
    formatInstaLabels({ brand: "Chevrolet", model: "Onix" }),
    { eyebrow: "Chevrolet", title: "Onix" },
  );
  assert.equal(
    formatInstaAlt({ brand: "Chevrolet", model: "Onix" }),
    "Chevrolet Onix entregue a cliente da Sua Garagem",
  );

  assert.deepEqual(
    formatInstaLabels({ brand: "Nissan", model: "Kicks Sense" }),
    { eyebrow: "Nissan", title: "Kicks Sense" },
  );
  assert.equal(
    formatInstaAlt({ brand: "Nissan", model: "Kicks Sense" }),
    "Nissan Kicks Sense entregue a cliente da Sua Garagem",
  );

  assert.deepEqual(
    formatInstaLabels({ brand: null, model: "Onix" }),
    { eyebrow: null, title: "Onix" },
  );
  assert.equal(
    formatInstaAlt({ brand: null, model: "Onix" }),
    "Onix entregue a cliente da Sua Garagem",
  );

  assert.deepEqual(
    formatInstaLabels({ brand: "BMW", model: null }),
    { eyebrow: null, title: "BMW" },
  );
  assert.equal(
    formatInstaAlt({ brand: "BMW", model: null }),
    "BMW entregue a cliente da Sua Garagem",
  );

  assert.deepEqual(
    formatInstaLabels({ brand: null, model: null }),
    { eyebrow: null, title: "Veículo entregue" },
  );
  assert.equal(
    formatInstaAlt({ brand: null, model: null }),
    "Veículo entregue a cliente da Sua Garagem",
  );
});

test("sliceInstaDeliveries, nextInstaDeliveriesCount, buildInstaSrcSet e isValidInstaLqip", () => {
  assert.equal(INSTA_DELIVERIES_PAGE_SIZE, 24);
  assert.ok(INSTA_DELIVERY_FADE_FALLBACK_MS >= 1500);
  const items = Array.from({ length: 60 }, (_, idx) => idx);
  assert.equal(sliceInstaDeliveries(items, 24).length, 24);
  assert.equal(nextInstaDeliveriesCount(24, items.length), 48);
  assert.equal(nextInstaDeliveriesCount(48, items.length), 60);
  assert.equal(nextInstaDeliveriesCount(60, items.length), 60);
  assert.equal(sliceInstaDeliveries(items, 999).length, 60);
  assert.equal(sliceInstaDeliveries(items, -5).length, 0);

  assert.equal(
    buildInstaSrcSet({
      srcSmall: "/vendidos-insta/foto-360.webp",
      src: "/vendidos-insta/foto.webp",
    }),
    "/vendidos-insta/foto-360.webp 360w, /vendidos-insta/foto.webp 600w",
  );

  const validUri = "data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=";
  assert.equal(isValidInstaLqip(validUri), true);
  assert.equal(isValidInstaLqip(""), false);
  assert.equal(isValidInstaLqip(null), false);
  assert.equal(isValidInstaLqip('") ; background: red; ("'), false);
  assert.equal(isValidInstaLqip("data:image/png;base64,AAAA"), false);
  assert.equal(
    isValidInstaLqip(`data:image/webp;base64,${"A".repeat(400)}`),
    false,
  );
});

test("manifesto vendidos-insta.json tem N itens válidos, src (600x750), srcSmall (360x450), lqip compacto e arquivos sem sobras", () => {
  const data = JSON.parse(
    readRepoFile("src/data/vendidos-insta.json"),
  ) as InstaDeliveryItem[];
  assert.ok(data.length >= 24, `manifesto deve ter ao menos 24 itens (obtido ${data.length})`);

  const webpFiles = new Set(
    readdirSync(join(repoRoot, "public/vendidos-insta")).filter((name) =>
      name.endsWith(".webp"),
    ),
  );
  assert.equal(
    webpFiles.size,
    data.length * 2,
    "public/vendidos-insta deve conter exatamente 2 arquivos WebP por item (600w e 360w)",
  );

  const seenIds = new Set<string>();
  const referencedFiles = new Set<string>();
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    assert.ok(item.id, `id ausente no índice ${i}`);
    assert.ok(!seenIds.has(item.id), `id duplicado: ${item.id}`);
    seenIds.add(item.id);
    assert.match(item.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(item.src, /^\/vendidos-insta\/.+\.webp$/);
    assert.match(item.srcSmall, /^\/vendidos-insta\/.+-360\.webp$/);
    assert.ok(
      item.lqip.startsWith("data:image/webp;base64,"),
      `lqip inválido em ${item.id}`,
    );
    assert.ok(
      item.lqip.length < 400,
      `lqip muito grande em ${item.id} (${item.lqip.length} chars)`,
    );
    assert.equal(isValidInstaLqip(item.lqip), true, `lqip inseguro em ${item.id}`);
    assert.equal("href" in item, false, `campo href não deve existir em ${item.id}`);
    assert.equal("year" in item, false, `campo year não deve existir em ${item.id}`);

    const fullPath = join(repoRoot, "public", item.src);
    assert.ok(existsSync(fullPath), `arquivo ausente: public${item.src}`);
    assert.deepEqual(
      readWebpDimensions(fullPath),
      { width: 600, height: 750 },
      `dimensão inesperada em ${item.src}`,
    );

    const smallPath = join(repoRoot, "public", item.srcSmall);
    assert.ok(existsSync(smallPath), `arquivo ausente: public${item.srcSmall}`);
    assert.deepEqual(
      readWebpDimensions(smallPath),
      { width: 360, height: 450 },
      `dimensão inesperada em ${item.srcSmall}`,
    );

    referencedFiles.add(item.src.replace(/^\/vendidos-insta\//, ""));
    referencedFiles.add(item.srcSmall.replace(/^\/vendidos-insta\//, ""));

    if (i > 0) {
      assert.ok(
        data[i - 1].date >= item.date,
        `ordem incorreta entre ${data[i - 1].date} e ${item.date}`,
      );
    }

    const labels = formatInstaLabels(item);
    assert.ok(labels.title.length > 0);
    const fullLabel = [labels.eyebrow, labels.title].filter(Boolean).join(" ");
    assert.doesNotMatch(fullLabel, /R\$\s*\d|\bsimul\w*\b|loja digital/i);

    const alt = formatInstaAlt(item);
    assert.match(alt, /entregue a cliente da Sua Garagem$/);
  }

  assert.equal(referencedFiles.size, webpFiles.size);
});

test("InstaDeliveriesGrid renderiza 24 iniciais, srcset 360w/600w, LQIP seguro sem ocultar no SSR, 4 eager (1ª high) e selo aria-hidden", () => {
  const data = JSON.parse(
    readRepoFile("src/data/vendidos-insta.json"),
  ) as InstaDeliveryItem[];

  const fullHtml = renderToStaticMarkup(
    createElement(InstaDeliveriesGrid, { items: data }),
  );
  assert.equal((fullHtml.match(/<li\b/g) ?? []).length, 24);
  assert.equal((fullHtml.match(/loading="eager"/g) ?? []).length, 4);
  assert.equal((fullHtml.match(/loading="lazy"/g) ?? []).length, 20);
  assert.equal(
    (fullHtml.match(/<img\b[^>]*fetchpriority="high"/gi) ?? []).length,
    1,
  );
  assert.equal(
    (fullHtml.match(/<img\b[^>]*\bsrcset="[^"]*360w, [^"]*600w"/gi) ?? []).length,
    24,
  );
  assert.equal((fullHtml.match(/data-delivery-lqip=""/g) ?? []).length, 24);
  assert.doesNotMatch(fullHtml, /data-photo-state="loading"/);
  assert.equal(
    (fullHtml.match(/aria-hidden="true"[^>]*data-sold-badge=""/g) ?? []).length,
    24,
  );
  assert.equal((fullHtml.match(/>VENDIDO<\/span>/g) ?? []).length, 24);
  assert.doesNotMatch(fullHtml, /<a\b|instagram\.com|Mostrando/i);
  assert.match(fullHtml, />Ver mais<\/button>/);

  const shortHtml = renderToStaticMarkup(
    createElement(InstaDeliveriesGrid, { items: data.slice(0, 10) }),
  );
  assert.equal((shortHtml.match(/<li\b/g) ?? []).length, 10);
  assert.doesNotMatch(shortHtml, /Ver mais/);

  // LQIP malicioso nunca é injetado em background-image.
  const unsafeHtml = renderToStaticMarkup(
    createElement(InstaDeliveriesGrid, {
      items: [{ ...data[0], lqip: '") ; background: red; ("' }],
    }),
  );
  assert.doesNotMatch(unsafeHtml, /data-delivery-lqip/);
});

test("página /vendidos segue visual limpo sem bordas nos cards, text-balance, 4 colunas no desktop e CTA WhatsApp no fim", () => {
  const pageSrc = readRepoFile("src/app/(site)/vendidos/page.tsx");
  const gridSrc = readRepoFile("src/components/site/InstaDeliveriesGrid.tsx");

  assert.ok(pageSrc.includes("InstaDeliveriesGrid"));
  assert.ok(pageSrc.includes("WhatsAppButton"));
  assert.ok(pageSrc.includes("Clientes que já saíram de carro novo da Garagem"));
  assert.match(pageSrc, /text-balance/);
  assert.doesNotMatch(
    pageSrc,
    /getSoldShowcaseData|getSiteStats|WantedVehicleCta|Veículos vendidos recentemente|Entregas registradas|Galeria de entregas em atualização/,
  );
  assert.match(gridSrc, /grid-cols-2 .*lg:grid-cols-4/);
  assert.match(gridSrc, /aspect-\[4\/5\]/);
  assert.match(gridSrc, /width=\{600\}/);
  assert.match(gridSrc, /height=\{750\}/);
  assert.match(gridSrc, /blur-\[12px\]/);
  assert.match(gridSrc, /scale-110/);
  assert.match(gridSrc, /motion-reduce:transition-none/);
  assert.match(gridSrc, /addEventListener\("pageshow"/);
  assert.match(gridSrc, /min-h-\[56px\]/);
  assert.match(gridSrc, /bg-brand\b/);
  assert.doesNotMatch(gridSrc, /\bborder(?:-[a-z0-9/]+)?\b/);
  assert.doesNotMatch(gridSrc, /<a\b|Mostrando|instagram\.com/i);

  for (const src of [pageSrc, gridSrc]) {
    assert.doesNotMatch(
      src,
      /\bsimul\w*\b|R\$\s*\d|loja digital|dourad|gold/i,
    );
  }
});
