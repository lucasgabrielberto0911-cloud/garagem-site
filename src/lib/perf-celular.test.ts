import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { SiteWordmark } from "@/components/site/SiteWordmark";
import { StatsBarSkeleton } from "@/components/site/StatsBar";
import { StockBackLink } from "@/components/site/StockBackLink";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { applyWhatsAppOrigin } from "@/lib/lead-origin";
import {
  galleryLcpMobileSrcSet,
  galleryLcpSrc,
  galleryPreviewSrc,
  galleryPreviewSrcSet,
  supabaseOriginalSrc,
} from "@/lib/stock-query";

const readSrc = (rel: string) => readFileSync(join(process.cwd(), "src", rel), "utf8");

test("fotos R2 (-g800.webp) usam preview 800w no LCP da ficha e mantêm 1280w no lightbox e desktop", () => {
  const r2Url =
    "https://pub-exemplo123.r2.dev/1731170000000-12345678-1234-4234-8234-123456789012-g800.webp";
  const r2Preview =
    "https://pub-exemplo123.r2.dev/1731170000000-12345678-1234-4234-8234-123456789012-g800-preview.webp";
  const photo = { id: "p1", url: r2Url, thumbnailUrl: null };

  assert.equal(galleryLcpSrc(photo), r2Preview);
  assert.equal(galleryLcpMobileSrcSet(photo), `${r2Preview} 800w`);
  assert.equal(galleryPreviewSrc(photo), r2Url);
  assert.equal(
    galleryPreviewSrcSet(photo),
    `${r2Preview} 800w, ${r2Url} 1280w`,
  );
  assert.equal(supabaseOriginalSrc(r2Preview), r2Url);
});

test("galeria prioriza e decodifica sincronamente o slide 0 (capa + fundo) sem baixar vizinhas grandes no SSR", () => {
  const photos = [0, 1, 2, 3].map((idx) => ({
    id: `p${idx}`,
    url: `https://pub-teste.r2.dev/foto-${idx}-g800.webp`,
    thumbnailUrl: `https://pub-teste.r2.dev/foto-${idx}-g800-card.webp`,
  }));

  const html = renderToStaticMarkup(
    createElement(VehicleGallery, { photos, alt: "Honda HR-V EXL 2016" }),
  );
  const slides = html.match(/<li\b[\s\S]*?<\/li>/g) ?? [];
  assert.equal(slides.length, 4);

  // Slide 0: tanto o fundo desfocado quanto a foto principal têm decoding="sync", fetchPriority="high" e <source> 800w mobile.
  assert.match(slides[0], /media="\(max-width: 639px\)"/);
  const slide0Imgs = slides[0].match(/<img\b[^>]*>/g) ?? [];
  assert.equal(slide0Imgs.length, 2);
  for (const img of slide0Imgs) {
    assert.match(img, /decoding="sync"/);
    assert.match(img, /fetchPriority="high"/);
    assert.match(img, /foto-0-g800-preview\.webp/);
  }

  // Slides 1 e 2: montam prévia leve com loading="eager", sem disputar banda das fotos grandes no SSR.
  for (const idx of [1, 2]) {
    assert.match(slides[idx], /loading="eager"/);
    assert.doesNotMatch(slides[idx], /loading="lazy"/);
    assert.doesNotMatch(slides[idx], /fetchPriority="high"/);
    assert.match(slides[idx], new RegExp(`foto-${idx}-g800-card\\.webp`));
    assert.doesNotMatch(slides[idx], new RegExp(`foto-${idx}-g800\\.webp`));
  }
});

test("applyWhatsAppOrigin mantém fast-path sem alterar links limpos e limpa sufixos antigos", () => {
  const clean =
    "https://wa.me/5527996330706?text=Oi!%20Vi%20o%20Honda%20Civic%20no%20site%20da%20Garagem.&utm_source=site";
  assert.equal(applyWhatsAppOrigin(clean, null), clean);
  assert.equal(applyWhatsAppOrigin(clean, "direto"), clean);

  const enriched = applyWhatsAppOrigin(clean, "instagram");
  assert.match(enriched, /Vim%20pelo%20Instagram\./);
  assert.equal(applyWhatsAppOrigin(enriched, null), clean);
});

test("SiteWordmark e StatsBarSkeleton reservam dimensões compatíveis para evitar CLS", () => {
  const footerLogo = renderToStaticMarkup(
    createElement(SiteWordmark, { size: "footer" }),
  );
  assert.match(footerLogo, /width="887"/);
  assert.match(footerLogo, /height="160"/);

  const skeleton = renderToStaticMarkup(createElement(StatsBarSkeleton));
  assert.match(skeleton, /px-2\.5 py-1\.5/);
  assert.match(skeleton, /mt-0\.5 h-4/);
});

test("StockBackLink renderiza no SSR sem bailout de useSearchParams e handlers evitam reflow síncrono", () => {
  const backHtml = renderToStaticMarkup(
    createElement(StockBackLink, { fallbackHref: "/estoque", variant: "overlay" }),
  );
  assert.match(backHtml, /href="\/estoque"/);
  assert.match(backHtml, /Estoque/);

  const backSrc = readSrc("components/site/StockBackLink.tsx");
  assert.doesNotMatch(backSrc, /useSearchParams/);

  const chatNudgeSrc = readSrc("components/site/ChatNudge.tsx");
  assert.doesNotMatch(chatNudgeSrc, /setInterval/);
  assert.match(chatNudgeSrc, /requestAnimationFrame/);

  const anchorsSrc = readSrc("components/site/FichaSectionAnchors.tsx");
  assert.match(anchorsSrc, /requestIdleCallback/);

  const heroSearchSrc = readSrc("components/site/HeroSearch.tsx");
  assert.match(heroSearchSrc, /passive:\s*true/);
  assert.doesNotMatch(heroSearchSrc, /onScroll=\{/);

  const marketingSrc = readSrc("components/MarketingScripts.tsx");
  assert.match(marketingSrc, /ssr:\s*false/);
});
