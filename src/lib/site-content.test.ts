import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeConditions, mergeFaqItems } from "./site-content";
import { STORE_WARRANTY } from "./vehicle-conditions";

const LEGACY_WARRANTY =
  "Na Sua Garagem, todo veículo passa por uma revisão completa antes de chegar até você. Por isso, oferecemos 3 meses de garantia em todos os nossos seminovos.";

test("override do painel substitui a garantia; texto antigo volta ao comercial", () => {
  const customIntro = "A cobertura deste lote é combinada no WhatsApp, sem prazo genérico.";
  const overridden = mergeConditions("Condições deste anúncio", customIntro, [
    { label: "Garantia", text: "Cobertura combinada caso a caso no WhatsApp." },
    { label: "Entrega", text: "Retirada em Linhares, combinada no WhatsApp." },
  ]);
  assert.equal(overridden.title, "Condições deste anúncio");
  assert.equal(overridden.intro, customIntro);
  assert.equal(
    overridden.items[0]?.text,
    "Cobertura combinada caso a caso no WhatsApp.",
  );
  assert.equal(overridden.items[1]?.text, "Retirada em Linhares, combinada no WhatsApp.");
  assert.doesNotMatch(overridden.intro, /revisão completa/i);

  const legacy = mergeConditions("Garantia de 3 meses (motor e câmbio)", LEGACY_WARRANTY, null);
  assert.equal(legacy.intro, STORE_WARRANTY.body);
  assert.match(legacy.intro, /garantia comercial de 3 meses/i);
  assert.doesNotMatch(legacy.intro, /revisão completa/i);

  const empty = mergeConditions("  ", "PREENCHER no painel", null);
  assert.equal(empty.title, STORE_WARRANTY.title);
  assert.equal(empty.intro, STORE_WARRANTY.body);
});

test("FAQ herda a garantia comercial e preserva resposta própria", () => {
  const merged = mergeFaqItems([
    {
      category: "compra",
      question: "Como funciona a garantia?",
      answer: LEGACY_WARRANTY,
    },
    {
      category: "compra",
      question: "Posso parcelar a entrada?",
      answer: "Sim. A entrada é combinada no WhatsApp.",
    },
  ]);
  assert.equal(merged[0]?.answer, STORE_WARRANTY.body);
  assert.equal(merged[1]?.answer, "Sim. A entrada é combinada no WhatsApp.");

  const custom = mergeFaqItems([
    {
      category: "compra",
      question: "Como funciona a garantia?",
      answer: "Neste mês a garantia comercial é de 90 dias, confirmada no contrato.",
    },
  ]);
  assert.equal(
    custom[0]?.answer,
    "Neste mês a garantia comercial é de 90 dias, confirmada no contrato.",
  );
});
