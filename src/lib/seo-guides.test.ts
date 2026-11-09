import assert from "node:assert/strict";
import test from "node:test";
import { SEO_GUIDES, getSeoGuide, pickGuideVehicles } from "./seo-guides";
import { getCityLocalContent } from "./city-local-content";

test("guias SEO: slugs do roteiro, 4 FAQs e sem parcela/simulador", () => {
  assert.deepEqual(SEO_GUIDES.map(g => g.slug), ["financiamento-seminovos-linhares", "troca-com-volta", "comparativos-estoque"]);
  for (const guide of SEO_GUIDES) {
    assert.equal(guide.faqs.length, 4);
    assert.ok(guide.description.length <= 170);
    assert.doesNotMatch(JSON.stringify(guide), /parcela|simulador|\d+x\b/i);
  }
  assert.ok(getSeoGuide("troca-com-volta"));
});

test("pickGuideVehicles casa o modelo sem acento e ignora outros", () => {
  const rows = [{ model: "Civic" }, { model: "HB20S" }, { model: "Ka+" }, { model: "Corolla" }];
  assert.deepEqual(pickGuideVehicles(rows, ["Civic", "Ka"]).map(r => r.model), ["Civic", "Ka+"]);
});

test("cidades prioritárias têm title, description e texto próprios", () => {
  const titles = new Set<string>();
  for (const slug of ["linhares", "serra", "vila-velha", "colatina"]) {
    const local = getCityLocalContent(slug);
    assert.ok(local && local.paragraphs.length >= 3 && local.faqs.length >= 2);
    assert.ok(local.description.length <= 170);
    titles.add(local.title);
  }
  assert.equal(titles.size, 4);
});
