import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BUYING_GUIDES } from "./buying-guides";
import { SEO_GUIDES, getSeoGuide, pickGuideVehicles } from "./seo-guides";
import { getCityLocalContent } from "./city-local-content";
import { getServiceCity } from "./service-cities";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("guias SEO: slugs do roteiro, 4 FAQs e sem parcela/simulação", () => {
  assert.deepEqual(SEO_GUIDES.map(g => g.slug), ["financiamento-seminovos-linhares", "troca-com-volta", "comparativos-estoque"]);
  for (const guide of SEO_GUIDES) {
    assert.equal(guide.faqs.length, 4);
    assert.ok(guide.description.length <= 170);
    assert.doesNotMatch(JSON.stringify(guide), /parcela|\bsimul\w*\b|\d+x\b/i);
  }
  assert.ok(getSeoGuide("troca-com-volta"));
});

test("página /guias lista BUYING_GUIDES (/guias/...) e SEO_GUIDES (/guia/...), e sitemap cobre ambos", () => {
  const pageSrc = read("src/app/(site)/guias/page.tsx");
  assert.ok(pageSrc.includes("BUYING_GUIDES"));
  assert.ok(pageSrc.includes("SEO_GUIDES"));
  assert.ok(pageSrc.includes("/guias/${guide.slug}"));
  assert.ok(pageSrc.includes("/guia/${guide.slug}"));
  assert.match(pageSrc, /export const revalidate = 3600/);

  const sitemapSrc = read("src/app/sitemap.ts");
  assert.ok(sitemapSrc.includes('path: "/guias"'));
  assert.ok(sitemapSrc.includes("BUYING_GUIDES.map"));
  assert.ok(sitemapSrc.includes("SEO_GUIDES.map"));
  assert.ok(sitemapSrc.includes("/guias/${guide.slug}"));
  assert.ok(sitemapSrc.includes("/guia/${guide.slug}"));
  assert.equal(BUYING_GUIDES.length, 5);
  assert.equal(SEO_GUIDES.length, 3);
});

test("pickGuideVehicles casa o modelo sem acento e ignora outros", () => {
  const rows = [{ model: "Civic" }, { model: "HB20S" }, { model: "Ka+" }, { model: "Corolla" }];
  assert.deepEqual(pickGuideVehicles(rows, ["Civic", "Ka"]).map(r => r.model), ["Civic", "Ka+"]);
});

test("cidades prioritárias têm title, description e texto próprios alinhados às praças", () => {
  const slugs = [
    "linhares",
    "aracruz",
    "vitoria",
    "grande-vitoria",
    "serra",
    "vila-velha",
    "colatina",
  ];
  const titles = new Set<string>();
  const headings = new Set<string>();
  for (const slug of slugs) {
    const local = getCityLocalContent(slug);
    assert.ok(local && local.paragraphs.length >= 3 && local.faqs.length >= 2, slug);
    assert.ok(local.description.length <= 170, `${slug}: description curta`);
    const raw = JSON.stringify(local);
    assert.match(raw, /Atendemos Linhares, Aracruz e Grande Vitória/, slug);
    assert.match(raw, /combinamos o atendimento pelo WhatsApp/i, slug);
    assert.doesNotMatch(
      raw,
      /loja física|loja digital|pontos de venda|ponto de venda|ponto físico|hora marcada|fica em Linhares|loja é em Linhares|parcela|simulador|\d+x\b|\b\d+\s*cv\b|\bmarchas\b|consignad/i,
      slug,
    );
    const cityQuestions = new Set(
      (getServiceCity(slug)?.faqs ?? []).map((item) => item.question),
    );
    for (const faq of local.faqs) {
      assert.equal(cityQuestions.has(faq.question), false, `${slug}: FAQ duplicada ${faq.question}`);
    }
    titles.add(local.title);
    headings.add(local.heading);
  }
  assert.equal(titles.size, slugs.length);
  assert.equal(headings.size, slugs.length);
});
