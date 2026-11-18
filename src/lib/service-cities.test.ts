import assert from "node:assert/strict";
import { test } from "node:test";
import { PHONES } from "./site";
import {
  SERVICE_CITIES,
  getServiceCity,
  otherServiceCities,
  type ServiceCity,
} from "./service-cities";

const EXPECTED = [
  "aracruz",
  "vitoria",
  "grande-vitoria",
  "linhares",
  "serra",
  "vila-velha",
  "guarapari",
  "cachoeiro-de-itapemirim",
  "colatina",
  "cariacica",
  "viana",
  "sao-mateus",
  "sooretama",
];

const FORBIDDEN_COPY =
  /loja física|loja digital|pontos de venda|ponto de venda|ponto físico|hora marcada|fica em Linhares|loja é em Linhares|Não temos loja|\b\d+\s*cv\b|\bmarchas\b|consignad/i;

test("cidades de atendimento cobrem o norte do ES, Grande Vitória, litoral e interior", () => {
  assert.deepEqual(
    SERVICE_CITIES.map((city) => city.slug),
    EXPECTED,
  );
  assert.equal(getServiceCity("grande-vitoria")?.name, "Grande Vitória");
  assert.equal(getServiceCity("guarapari")?.name, "Guarapari");
  assert.equal(getServiceCity("cachoeiro-de-itapemirim")?.name, "Cachoeiro de Itapemirim");
  assert.equal(getServiceCity("inexistente"), null);
  assert.equal(otherServiceCities("serra").length, SERVICE_CITIES.length - 1);
});

test("slugs são únicos e o texto nunca menciona loja física, pontos de venda nem hora marcada", () => {
  const slugs = SERVICE_CITIES.map((city) => city.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const city of SERVICE_CITIES) {
    const blob = `${city.lead} ${city.paragraphs.join(" ")}`;
    assert.match(blob, /WhatsApp|site/i);
    assert.doesNotMatch(JSON.stringify(city), FORBIDDEN_COPY, city.slug);
  }

  const grandeVitoria = getServiceCity("grande-vitoria");
  assert.ok(grandeVitoria);
  const gvBlob = JSON.stringify(grandeVitoria);
  assert.match(gvBlob, /Atendemos Linhares, Aracruz e Grande Vitória/);
  assert.match(gvBlob, /Combinamos o atendimento pelo WhatsApp/);
});

const COLD_COPY = [
  /deslocamento cego/i,
  /concentra o noroeste/i,
  /ritmo de /i,
  /\btriagem\b/i,
  /\btriar\b/i,
  /às cegas/i,
  /inventamos/i,
];

const LOCAL_MARKS: Record<string, readonly string[]> = {
  aracruz: ["Coqueiral", "Barra do Riacho", "ES-010"],
  vitoria: ["Praia do Canto", "Jardim da Penha", "Terceira Ponte"],
  "grande-vitoria": ["Vitória", "Vila Velha", "Serra", "Cariacica"],
  linhares: ["Araçá", "BR-101", "Rio Doce"],
  serra: ["Laranjeiras", "Carapina", "Civit"],
  "vila-velha": ["Praia da Costa", "Itapoã", "Terceira Ponte"],
  guarapari: ["Praia do Morro", "Muquiçaba", "ES-060"],
  "cachoeiro-de-itapemirim": ["Independência", "BR-101"],
  colatina: ["São Silvano", "Honório Fraga", "Rio Doce"],
  cariacica: ["Campo Grande", "Itacibá", "Porto de Santana"],
  viana: ["Marcílio de Noronha", "BR-262", "Universal"],
  "sao-mateus": ["São Mateus", "BR-101"],
  sooretama: ["Sooretama", "BR-101"],
};

test("tom de consultor: fala com você, cita o lugar e evita anúncio frio", () => {
  const leads = new Set<string>();
  const metas = new Set<string>();
  const openings = new Set<string>();
  const closings = new Set<string>();

  for (const city of SERVICE_CITIES) {
    const blob = [
      city.metaDescription,
      city.lead,
      ...city.paragraphs,
      ...city.bullets,
    ].join("\n");

    assert.match(city.metaDescription, new RegExp(escapeRegExp(city.name)));
    assert.match(city.lead, /você/i);
    assert.match(blob, /8h/);
    assert.match(blob, /WhatsApp/);
    assert.match(blob, /ficha|fotos|preço/i);
    assert.ok(city.bullets.some((item) => item.includes(PHONES[0].label)));
    assert.equal(city.paragraphs.length, 2);

    for (const pattern of COLD_COPY) {
      assert.doesNotMatch(blob, pattern, city.slug);
    }
    if (/garantia/i.test(blob)) {
      assert.match(blob, /garantia comercial de 3 meses para motor e câmbio/);
    }

    for (const mark of LOCAL_MARKS[city.slug] ?? []) {
      assert.ok(blob.includes(mark), `${city.slug} deve citar ${mark}`);
    }

    assert.equal(leads.has(city.lead), false, city.slug);
    assert.equal(metas.has(city.metaDescription), false, city.slug);
    assert.equal(openings.has(city.paragraphs[0]), false, city.slug);
    assert.equal(closings.has(city.paragraphs[1]), false, city.slug);
    leads.add(city.lead);
    metas.add(city.metaDescription);
    openings.add(city.paragraphs[0]);
    closings.add(city.paragraphs[1]);
  }

  const colatina = getServiceCity("colatina");
  assert.ok(colatina);
  assert.match(colatina.lead, /São Silvano/);
  assert.match(colatina.lead, /Honório Fraga/);
  assert.doesNotMatch(colatina.lead, /concentra/);
  assert.match(colatina.paragraphs[1], /8h às 23h/);
  assert.match(colatina.paragraphs[1], /proposta estiver clara/);
  assert.doesNotMatch(colatina.paragraphs.join(" "), /deslocamento cego/);
  assert.doesNotMatch(colatina.bullets.join(" "), /ritmo de Colatina/);
});

test("Linhares explica o atendimento real, sem prometer loja física", () => {
  const linhares = getServiceCity("linhares");
  assert.ok(linhares);
  assert.ok(linhares.steps);
  assert.equal(linhares.steps.length, 4);

  const steps = linhares.steps.map((step) => `${step.title} ${step.text}`).join(" ");
  assert.match(steps, /WhatsApp/);
  assert.match(steps, /vídeo/);
  assert.match(steps, /combinada em Linhares/);
  assert.match(steps, /Troca/);
  assert.match(steps, /financiamento/);
  assert.match(steps, /Filtre o estoque/);
  assert.doesNotMatch(steps, /showroom|endereço|ponto físico|nossa loja|hora marcada/i);

  assert.match(linhares.paragraphs[1], /Atendemos Linhares, Aracruz e Grande Vitória/);
  assert.match(linhares.paragraphs[1], /Combinamos o atendimento pelo WhatsApp/);
  assert.doesNotMatch(linhares.metaDescription, /loja em|showroom|endereço|hora marcada/i);

  assert.match(linhares.faqs.map((item) => item.answer).join(" "), /até 60x/);
  assert.match(linhares.faqs.map((item) => item.answer).join(" "), /até 18x/);

  for (const city of SERVICE_CITIES) {
    if (city.slug !== "linhares") assert.equal((city as ServiceCity).steps, undefined, city.slug);
  }
});

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
