import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import React from "react";
import { LegendPasteField } from "../components/admin/LegendPasteField";
import { mergeLegendAccessories, parseLegend } from "./legend-parser";
import { getAccessoryPresets } from "./vehicle-accessories";

test("normaliza acentos, caixa e espaços, mantendo a legenda original", () => {
  const text = "  DIRECAO   Eletrica; Câmera de ré  ";
  const result = parseLegend(text, "carro");
  assert.deepEqual(new Set(result.matched), new Set(["Direção elétrica", "Câmera de ré"]));
  assert.deepEqual(result.unmatched, []);
  assert.equal(result.fullText, text);
  assert.deepEqual(parseLegend("Direção elétrica".normalize("NFD"), "carro").matched, ["Direção elétrica"]);
});

test("sinônimos usam palavras inteiras e o maior casamento primeiro", () => {
  const result = parseLegend("ar condicionado gelado, ar condicionado digital, central multimídia; carplay / android auto; cam de ré; couro", "carro");
  assert.deepEqual(new Set(result.matched), new Set([
    "Ar-condicionado", "Ar digital", "Multimídia", "Apple CarPlay / Android Auto", "Câmera de ré", "Bancos de couro",
  ]));
  assert.deepEqual(result.unmatched, []);
  assert.deepEqual(parseLegend("alarmeado ledor absurdo centralizado", "carro").matched, []);
});

test("legenda real mistura presets e pontos manuais sem aplicar nada", () => {
  const text = "🚗 GARAGEM\n✅ Ar-condicionado\n✅ Dir elétrica • Vidro elétrico / trava elétrica\n✅ Único dono; Revisões na concessionária\nhttps://suagaragem.net/estoque/123";
  const result = parseLegend(text, "carro");
  assert.deepEqual(new Set(result.matched), new Set(["Ar-condicionado", "Direção elétrica", "Vidros elétricos", "Travas elétricas"]));
  assert.deepEqual(result.unmatched, ["Único dono", "Revisões na concessionária"]);
  assert.equal(result.fullText, text);
  assert.equal(result.description, "Ar-condicionado\nDir elétrica • Vidro elétrico / trava elétrica\nÚnico dono; Revisões na concessionária");
});

test("cada categoria reconhece somente seus presets; maior preset não duplica o menor", () => {
  const result = parseLegend("Direção elétrica; ABS; painel digital TFT; bauleto original; freio a disco (dianteiro e traseiro)", "moto");
  assert.deepEqual(new Set(result.matched), new Set(["ABS", "Painel digital TFT", "Bauleto original", "Freio a disco (dianteiro e traseiro)"]));
  assert.deepEqual(result.unmatched, ["Direção elétrica"]);
  for (const category of ["carro", "moto"] as const) {
    for (const preset of getAccessoryPresets(category)) {
      assert.deepEqual(parseLegend(preset, category), { matched: [preset], unmatched: [], fullText: preset, description: preset });
    }
  }
});

test("vazio, emoji e URLs não geram itens nem reconhecem termos dentro de URLs", () => {
  for (const text of ["", "  \n ", "🚗🔥✅", "https://exemplo.com/abs/alarme", "www.exemplo.com/led"]) {
    assert.deepEqual(parseLegend(text, "carro"), { matched: [], unmatched: [], fullText: text, description: "" });
  }
});

test("deduplica presets e pontos manuais sem acento e limita a 60 itens", () => {
  const result = parseLegend("ABS; abs; Único dono; unico dono; " + Array.from({ length: 80 }, (_, i) => `Ponto manual ${i}`).join(";"), "carro");
  assert.deepEqual(result.matched, ["ABS"]);
  assert.equal(result.unmatched[0], "Único dono");
  assert.equal(result.matched.length + result.unmatched.length, 60);
});

test("merge preserva existentes de outra categoria e filtra somente acréscimos", () => {
  const parsed = parseLegend("ABS; Painel digital; Único dono", "moto");
  const existing = ["Pneus novos", "ABS", "Direção elétrica"];
  const merged = mergeLegendAccessories(existing, [...parsed.matched, ...parsed.unmatched], "moto");
  assert.deepEqual(merged, [...existing, "Painel digital", "Único dono"]);
  assert.deepEqual(existing, ["Pneus novos", "ABS", "Direção elétrica"]);
  assert.deepEqual(mergeLegendAccessories([], ["Direção elétrica", "ABS"], "moto"), ["ABS"]);
});

test("presets de LED e rodas não competem com aliases da outra categoria", () => {
  for (const [category, led, wheels] of [
    ["carro", "Faróis de LED", "Rodas de liga leve"],
    ["moto", "Farol de LED", "Rodas de liga"],
  ] as const) {
    assert.deepEqual(new Set(parseLegend(`${led}; ${wheels}`, category).matched), new Set([led, wheels]));
    assert.deepEqual(new Set(parseLegend("led; liga leve", category).matched), new Set([led, wheels]));
  }
});

test("central de ar condicionado não marca multimídia", () => {
  assert.deepEqual(parseLegend("Central de ar condicionado", "carro").matched, ["Ar-condicionado"]);
  assert.deepEqual(parseLegend("central", "carro").matched, []);
  assert.deepEqual(parseLegend("central multimídia", "carro").matched, ["Multimídia"]);
});

test("descrição remove cabeçalho, emojis, URLs e corrige a marca no texto útil", () => {
  const result = parseLegend("🚗 **SUA GARAGEM** 🔥\r\n✅ Único dono 🏍️\r\nRevisado na Sua Garagem.\r\nPneu 120/70-17; ano 2019-2021\r\nhttps://suagaragem.net/estoque/123\r\nwww.exemplo.com/abs", "moto");
  assert.equal(result.description, "Único dono\nRevisado na Garagem.\nPneu 120/70-17; ano 2019-2021");
  assert.deepEqual(result.matched, []);
  assert.deepEqual(parseLegend("🚗 GARAGEM\n🔥", "carro").unmatched, []);
});

test("fragmentos preservam medidas, intervalos e hífens internos", () => {
  const result = parseLegend("pneu 120/70-17; 2019-2021; azul-escuro; revisão/garantia • Único dono - IPVA pago", "moto");
  assert.deepEqual(result.unmatched, ["pneu 120/70-17", "2019-2021", "azul-escuro", "revisão/garantia", "Único dono", "IPVA pago"]);
});

test("merge recusa excesso sem truncar existentes ou acréscimos", () => {
  const existing = Array.from({ length: 60 }, (_, i) => `Item ${i}`);
  assert.equal(mergeLegendAccessories(existing, ["ABS"], "moto"), null);
  assert.equal(existing.length, 60);
  assert.deepEqual(mergeLegendAccessories(existing, ["item 0"], "moto"), existing);
  const oversized = [...existing, "Direção elétrica"];
  assert.deepEqual(mergeLegendAccessories(oversized, [], "moto"), oversized);
  assert.equal(mergeLegendAccessories(oversized, ["ABS"], "moto"), null);
  assert.deepEqual(mergeLegendAccessories(existing.slice(0, 59), ["ABS", "abs"], "moto"), [...existing.slice(0, 59), "ABS"]);
  assert.equal(mergeLegendAccessories([], Array.from({ length: 61 }, (_, i) => `Novo ${i}`), "moto"), null);
});

test("merge deduplica sem acento e mantém o texto existente intacto", () => {
  assert.deepEqual(mergeLegendAccessories(["Único dono", "Texto  existente"], ["unico dono", "texto existente", "ABS"], "carro"), ["Único dono", "Texto  existente", "ABS"]);
});

test("merge preserva pontos manuais da outra categoria, deduplica e respeita o limite", () => {
  assert.deepEqual(mergeLegendAccessories([], ["Direção elétrica", "ABS"], "moto", ["Direção elétrica", "abs"]), ["ABS", "Direção elétrica"]);
  assert.deepEqual(mergeLegendAccessories(["Direção elétrica"], [], "moto", ["direcao eletrica"]), ["Direção elétrica"]);
  const existing = Array.from({ length: 59 }, (_, i) => `Item ${i}`);
  assert.deepEqual(mergeLegendAccessories(existing, [], "moto", ["Direção elétrica"]), [...existing, "Direção elétrica"]);
  assert.equal(mergeLegendAccessories(existing, ["ABS"], "moto", ["Direção elétrica"]), null);
  assert.equal(existing.length, 59);
});

test("conectores não viram pontos manuais ao remover presets", () => {
  for (const text of ["Couro e Manual", "Manual E Couro", "Couro e Manual e Revisado"]) {
    const result = parseLegend(text, "carro");
    assert.deepEqual(result.matched, ["Bancos de couro"]);
    assert.deepEqual(result.unmatched, text.includes("Revisado") ? ["Manual", "Revisado"] : ["Manual"]);
  }
  assert.deepEqual(parseLegend("Couro e ABS", "carro").unmatched, []);
});

// Executa os handlers do componente com estado persistente, sem navegador ou dependências extras.
function legendField(t: TestContext, overrides: Partial<React.ComponentProps<typeof LegendPasteField>> = {}) {
  const state: unknown[] = [];
  let cursor = 0;
  t.mock.method(React, "useId", () => "legenda-teste");
  t.mock.method(React, "useState", ((initial: unknown) => {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
    return [state[index], (next: unknown) => {
      state[index] = typeof next === "function" ? next(state[index]) : next;
    }];
  }) as typeof React.useState);
  const props: React.ComponentProps<typeof LegendPasteField> = {
    category: "moto", description: "Descrição existente", onApply: () => true, ...overrides,
  };
  function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!React.isValidElement<Record<string, unknown>>(node)) return [];
    return [node, ...elements(node.props.children as React.ReactNode)];
  }
  function find(predicate: (element: React.ReactElement<Record<string, unknown>>) => boolean) {
    cursor = 0;
    const element = elements(LegendPasteField(props)).find(predicate);
    assert.ok(element, "Controle esperado na legenda");
    return element.props;
  }
  return {
    props,
    textarea: () => find((element) => element.type === "textarea"),
    click: (label: string) => (find((element) => element.type === "button" && element.props.children === label).onClick as () => void)(),
    change: (text: string) => (find((element) => element.type === "textarea").onChange as (event: unknown) => void)({ target: { value: text } }),
    useDescription: () => {
      const label = find((element) => element.type === "label" && Array.isArray(element.props.children) && element.props.children.includes("Usar texto limpo como descrição"));
      const checkbox = elements(label.children as React.ReactNode)[0];
      (checkbox.props.onChange as (event: unknown) => void)({ target: { checked: true } });
    },
  };
}

test("cancelar troca da descrição ainda aplica os acessórios e pontos manuais", (t) => {
  const apply = t.mock.fn(() => true);
  const confirm = t.mock.fn(() => false);
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { confirm } });
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });
  const field = legendField(t, { onApply: apply });
  field.change("ABS; Direção elétrica");
  field.click("Analisar");
  field.click("Adicionar como ponto manual");
  field.useDescription();
  field.click("Aplicar");
  assert.equal(confirm.mock.callCount(), 1);
  assert.deepEqual(apply.mock.calls[0].arguments, [["ABS"], ["Direção elétrica"], undefined]);
});

test("reanalisar e trocar categoria preservam texto e pontos manuais", (t) => {
  const apply = t.mock.fn(() => true);
  const field = legendField(t, { onApply: apply });
  field.change("Direção elétrica; Único dono");
  field.click("Analisar");
  field.click("Adicionar como ponto manual");
  field.click("Analisar");
  field.props.category = "carro";
  assert.equal(field.textarea().value, "Direção elétrica; Único dono");
  field.click("Analisar");
  field.props.category = "moto";
  field.click("Analisar");
  field.click("Aplicar");
  assert.deepEqual(apply.mock.calls[0].arguments, [[], ["Direção elétrica"], undefined]);
});
