import test from "node:test";
import assert from "node:assert/strict";
import { cleanTestimonialField } from "@/lib/testimonials-clean";

test("cleanTestimonialField remove 'exemplo ilustrativo da loja' em maiúsculas com quebra de linha", () => {
  const input = "Aracruz, ES\nEXEMPLO ILUSTRATIVO DA LOJA";
  assert.equal(cleanTestimonialField(input), "Aracruz, ES");
});

test("cleanTestimonialField remove variações com hífen e traço", () => {
  assert.equal(
    cleanTestimonialField("Colatina, ES - EXEMPLO ILUSTRATIVO DA LOJA"),
    "Colatina, ES",
  );
  assert.equal(
    cleanTestimonialField("Serra, ES — Exemplo Ilustrativo"),
    "Serra, ES",
  );
  assert.equal(
    cleanTestimonialField("Linhares, ES (exemplo ilustrativo da loja)"),
    "Linhares, ES",
  );
});

test("cleanTestimonialField remove texto se ele for exclusivamente o aviso", () => {
  assert.equal(cleanTestimonialField("EXEMPLO ILUSTRATIVO DA LOJA"), null);
  assert.equal(cleanTestimonialField("exemplo ilustrativo"), null);
  assert.equal(cleanTestimonialField("ILUSTRATIVO DA LOJA"), null);
});

test("cleanTestimonialField lida com tags HTML e quebras CRLF", () => {
  assert.equal(
    cleanTestimonialField("Vitória, ES<br><span>EXEMPLO ILUSTRATIVO DA LOJA</span>"),
    "Vitória, ES",
  );
  assert.equal(
    cleanTestimonialField("Vila Velha, ES\r\nEXEMPLO ILUSTRATIVO DA LOJA"),
    "Vila Velha, ES",
  );
});

test("cleanTestimonialField preserva textos legítimos sem o aviso", () => {
  assert.equal(cleanTestimonialField("Aracruz, ES"), "Aracruz, ES");
  assert.equal(cleanTestimonialField("Sobre Onix 2021"), "Sobre Onix 2021");
  assert.equal(cleanTestimonialField("Camila R."), "Camila R.");
  assert.equal(cleanTestimonialField(null), null);
  assert.equal(cleanTestimonialField(undefined), null);
  assert.equal(cleanTestimonialField("   "), null);
});
