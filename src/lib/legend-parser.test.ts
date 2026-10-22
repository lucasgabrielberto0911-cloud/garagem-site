import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import React from "react";
import { LegendPasteField } from "../components/admin/LegendPasteField";
import { fold, mergeLegendAccessories, parseLegend } from "./legend-parser";
import { getAccessoryPresets } from "./vehicle-accessories";

import { equipmentLegend } from "./__fixtures__/legend-lucas";

test("as 15 linhas marcadas são selecionadas ou criadas sem perder detalhes e compostos", () => {
  const result = parseLegend(equipmentLegend, "carro");
  assert.deepEqual(new Set(result.matched), new Set([
    "Multimídia", "Apple CarPlay / Android Auto", "Ar digital", "Keyless (partida por botão)",
    "Faróis de LED", "Rodas de liga leve", "Direção elétrica", "Vidros elétricos", "Travas elétricas",
    "Retrovisores elétricos", "Câmera de ré", "Sensor de estacionamento", "Controle de estabilidade", "ABS",
  ]));
  assert.deepEqual(result.unmatched, result.listed);
  const saved = mergeLegendAccessories([], result.matched, "carro", result.listed);
  assert.ok(saved);
  const lines = equipmentLegend.split("\n").filter((line) => line.startsWith("✅"));
  assert.equal(lines.length, 15);
  for (const line of lines) {
    const parsed = parseLegend(line, "carro");
    const items = [...parsed.matched, ...(parsed.listed ?? [])];
    assert.ok(items.length, `Linha perdida: ${line}`);
    for (const item of items) assert.ok(saved.includes(item), `Item perdido: ${item}`);
  }
  for (const item of [
    'Central multimídia de 10,1" com Apple CarPlay e Android Auto sem fio',
    'Painel de instrumentos digital de 7"', 'Rodas de liga leve aro 18"', "4 airbags",
    "Controle de tração", "Assistente de partida em rampa", "EBD", "ISOFIX",
  ]) assert.ok(saved.includes(item), `Detalhe perdido: ${item}`);
  assert.ok(!saved.includes("Airbag duplo"));
  assert.ok(!saved.some((item) => /conforto:|segurança:|✅|✨|🛡/iu.test(item)));
});

test("marcadores variados e texto sem acento reconhecem presets e preservam itens livres inteiros", () => {
  const result = parseLegend(`Conforto:
• DIRECAO ELETRICA
- Vidros, travas e retrovisores eletricos
* CarPlay e Android Auto
✔ Chave presencial com partida por botao
🔹 Bancos com aquecimento e memoria
Seguranca:
🛞 Controle de tracao e estabilidade
▪ Freios ABS com EBD`, "carro");
  assert.deepEqual(new Set(result.matched), new Set([
    "Direção elétrica", "Vidros elétricos", "Travas elétricas", "Retrovisores elétricos",
    "Apple CarPlay / Android Auto", "Keyless (partida por botão)", "Controle de estabilidade", "ABS",
  ]));
  assert.deepEqual(result.listed, ["Bancos com aquecimento e memoria", "Controle de tração", "EBD"]);
});

test("itens já existentes não duplicam e linha marcada não descarta preset de outra categoria", () => {
  const result = parseLegend(`Opcionais:
★ camera de re
– CAMERA DE RE
* Revisoes e garantia de fabrica
✔ Bauleto original`, "carro");
  assert.deepEqual(result.matched, ["Câmera de ré"]);
  assert.deepEqual(result.listed, ["Revisoes e garantia de fabrica", "Bauleto original"]);
  assert.deepEqual(mergeLegendAccessories(["Câmera de ré"], result.matched, "carro", result.listed), [
    "Câmera de ré", "Revisoes e garantia de fabrica", "Bauleto original",
  ]);
});

test("lista marcada acima do limite é recusada sem perder silenciosamente os últimos itens", () => {
  const result = parseLegend(Array.from({ length: 61 }, (_, i) => `✅ Equipamento exclusivo ${i}`).join("\n"), "carro");
  assert.equal(result.listed?.length, 61);
  assert.equal(mergeLegendAccessories([], result.matched, "carro", result.listed), null);
});

test("compostos sem marcador também reconhecem os presets e mantêm o texto da descrição", () => {
  const text = "Vidros, travas e retrovisores elétricos; Controle de tração e de estabilidade; ABS com EBD";
  const result = parseLegend(text, "carro");
  assert.deepEqual(new Set(result.matched), new Set([
    "Vidros elétricos", "Travas elétricas", "Retrovisores elétricos", "Controle de estabilidade", "ABS",
  ]));
  assert.deepEqual(result.unmatched, ["Controle de tração", "EBD"]);
  assert.equal(result.description, text);
});

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

test("sinônimos completos consomem a expressão sem sobrar prefixos", () => {
  for (const [text, preset] of [
    ["farol de led", "Faróis de LED"],
    ["farois de led", "Faróis de LED"],
    ["bancos em couro", "Bancos de couro"],
    ["banco em couro", "Bancos de couro"],
    ["start stop", "Keyless (partida por botão)"],
    ["chave presencial", "Keyless (partida por botão)"],
    ["ar condicionado gelando", "Ar-condicionado"],
  ]) {
    const result = parseLegend(text, "carro");
    assert.deepEqual(result.matched, [preset]);
    assert.deepEqual(result.unmatched, []);
    assert.deepEqual(parseLegend(`Revisado; ${text}; Único dono`, "carro").unmatched, ["Revisado", "Único dono"]);
  }
  for (const text of ["farol de led", "farois de led"]) {
    assert.deepEqual(parseLegend(text, "moto").matched, ["Farol de LED"]);
    assert.deepEqual(parseLegend(text, "moto").unmatched, []);
  }
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
  assert.deepEqual(result.unmatched, []);
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
  assert.deepEqual(result.unmatched, ["pneu 120/70-17", "azul-escuro", "revisão/garantia", "Único dono", "IPVA pago"]);
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

test("remoção de um preset preserva a frase ao redor", () => {
  const result = parseLegend("Revisado na concessionária Ar-condicionado Único dono", "carro");
  assert.deepEqual(result.matched, ["Ar-condicionado"]);
  assert.deepEqual(result.unmatched, ["Revisado na concessionária Único dono"]);
});

test("remoção de vários presets mantém o texto restante na mesma frase", () => {
  const result = parseLegend("Único dono Ar-condicionado IPVA pago Direção elétrica Garantia de fábrica", "carro");
  assert.deepEqual(new Set(result.matched), new Set(["Ar-condicionado", "Direção elétrica"]));
  assert.deepEqual(result.unmatched, ["Único dono IPVA pago Garantia de fábrica"]);
});

test("fold normaliza acentos e caixa", () => {
  assert.equal(fold("Único dono"), fold("unico dono"));
  assert.equal(fold("ÚNICO DONO"), fold("único dono"));
  assert.equal(fold("Direção elétrica"), fold("direcao eletrica"));
  assert.equal(fold("Câmera de ré"), fold("camera de re"));
});

// Executa os handlers do componente com estado persistente, sem navegador ou dependências extras.
function legendField(t: TestContext, overrides: Partial<React.ComponentProps<typeof LegendPasteField>> = {}) {
  const state: unknown[] = [];
  const refStore = { current: "" };
  let cursor = 0;
  t.mock.method(React, "useId", () => "legenda-teste");
  t.mock.method(React, "useRef", () => refStore);
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
    remove: (label: string) => (find((element) => element.type === "button" && element.props["aria-label"] === `Remover ${label}`).onClick as () => void)(),
    change: (text: string) => (find((element) => element.type === "textarea").onChange as (event: unknown) => void)({ target: { value: text } }),
    deselect: (label: string) => {
      cursor = 0;
      const all = elements(LegendPasteField(props));
      const labelEl = all.find(
        (el) => el.type === "label" &&
          elements(el.props.children as React.ReactNode).some(
            (child) => child.type === "span" && child.props.children === label,
          ),
      );
      assert.ok(labelEl, `Checkbox para "${label}" não encontrado`);
      const checkbox = elements(labelEl.props.children as React.ReactNode).find(
        (child) => child.type === "input" && child.props.type === "checkbox",
      );
      assert.ok(checkbox, `Checkbox para "${label}" não encontrado`);
      (checkbox.props.onChange as (event: unknown) => void)({ target: { checked: false } });
    },
    useDescription: () => {
      const label = find((element) => element.type === "label" && Array.isArray(element.props.children) && element.props.children.includes("Usar texto limpo como descrição"));
      const checkbox = elements(label.children as React.ReactNode)[0];
      (checkbox.props.onChange as (event: unknown) => void)({ target: { checked: true } });
    },
  };
}

test("legenda permanece pendente até aplicar com sucesso ou limpar o texto", (t) => {
  const pending = t.mock.fn();
  let success = false;
  const field = legendField(t, { onPendingChange: pending, onApply: () => success });
  field.change("ABS");
  assert.deepEqual(pending.mock.calls.map(call => call.arguments), [[true]]);
  field.click("Analisar");
  field.click("Aplicar");
  assert.equal(pending.mock.callCount(), 1);
  success = true;
  field.click("Aplicar");
  assert.deepEqual(pending.mock.calls[1].arguments, [false]);
  field.change("Direção elétrica");
  field.change("   ");
  assert.deepEqual(pending.mock.calls.slice(2).map(call => call.arguments), [[true], [false]]);
});

test("aplicar legenda marcada inclui automaticamente os 15 itens no array salvo", (t) => {
  let saved: string[] | null = [];
  const field = legendField(t, { category: "carro", onApply: (selected, manual) => {
    saved = mergeLegendAccessories(["Direção elétrica"], selected, "carro", manual);
    return saved !== null;
  } });
  field.change(equipmentLegend);
  field.click("Analisar");
  field.click("Analisar");
  field.click("Aplicar");
  const parsed = parseLegend(equipmentLegend, "carro");
  assert.deepEqual(new Set(saved), new Set([...parsed.matched, ...(parsed.listed ?? [])]));
  assert.equal(field.textarea().value, "");
});

test("remover opcional livre automático persiste ao reanalisar a legenda", (t) => {
  const apply = t.mock.fn(() => true);
  const field = legendField(t, { category: "carro", onApply: apply });
  field.change("✅ ISOFIX\n✅ Direção elétrica");
  field.click("Analisar");
  field.remove("ISOFIX");
  field.click("Analisar");
  field.click("Aplicar");
  assert.deepEqual(apply.mock.calls[0].arguments, [["Direção elétrica"], [], undefined]);
});

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
  field.change("ABS; Revisado na concessionária");
  field.click("Analisar");
  field.click("Adicionar como ponto manual");
  field.useDescription();
  field.click("Aplicar");
  assert.equal(confirm.mock.callCount(), 1);
  assert.deepEqual(apply.mock.calls[0].arguments, [["ABS"], ["Revisado na concessionária"], undefined]);
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
  assert.deepEqual(apply.mock.calls[0].arguments, [[], ["Único dono"], undefined]);
});

test("trocar o texto limpa pontos manuais e seleção da legenda anterior", (t) => {
  const apply = t.mock.fn(() => true);
  const field = legendField(t, { onApply: apply });
  field.change("Ar-condicionado; Único dono");
  field.click("Analisar");
  field.click("Adicionar como ponto manual");
  field.change("ABS");
  field.click("Analisar");
  field.click("Aplicar");
  assert.deepEqual(apply.mock.calls[0].arguments, [["ABS"], [], undefined]);
});

test("reanalisar o mesmo texto preserva itens desmarcados", (t) => {
  const apply = t.mock.fn(() => true);
  const field = legendField(t, { onApply: apply, category: "carro" });
  field.change("Ar-condicionado; Direção elétrica; Único dono");
  field.click("Analisar");
  field.deselect("Ar-condicionado");
  field.click("Analisar");
  field.click("Aplicar");
  assert.deepEqual(apply.mock.calls[0].arguments, [["Direção elétrica"], [], undefined]);
});


test("LED diurno tem prioridade sobre o alias genérico LED", () => {
  assert.deepEqual(parseLegend("LED diurno", "moto").matched, ["LED diurno (DRL)"]);
  assert.deepEqual(parseLegend("LED diurno", "moto").unmatched, []);
  assert.deepEqual(new Set(parseLegend("led; LED diurno", "moto").matched), new Set(["Farol de LED", "LED diurno (DRL)"]));
});

test("sugestões descartam números e fragmentos com menos de três letras sem quebrar frases", () => {
  for (const text of ["central multimídia 7", "2019 - 2021", "2019-2021", "a; de; 12; 7 pol 7"]) {
    assert.deepEqual(parseLegend(text, "carro").unmatched, text.includes("pol") ? ["7 pol 7"] : []);
  }
  assert.deepEqual(parseLegend("Revisado e Ar-condicionado novo", "carro").unmatched, ["Revisado novo"]);
  assert.deepEqual(parseLegend("Revisado Ar-condicionado e novo", "carro").unmatched, ["Revisado novo"]);
  assert.deepEqual(parseLegend("Revisado e Ar-condicionado novo; Único dono", "carro").unmatched, ["Revisado novo", "Único dono"]);
});

test("sugestões excluem presets exclusivos da outra categoria, inclusive sem acentos", () => {
  assert.deepEqual(parseLegend("DIRECAO   ELETRICA; Direção hidráulica; Único dono", "moto").unmatched, ["Único dono"]);
  assert.deepEqual(parseLegend("Bauleto original; Painel digital TFT; Revisado", "carro").unmatched, ["Revisado"]);
});

test("filtro da outra categoria normaliza hífens e espaços e inclui sinônimos", () => {
  const text = "AR CONDICIONADO; ar-condicionado; ar   condicionado; ar condicionado gelando; dir-eletrica; dir hidráulica; bancos em couro; banco em couro; start-stop; chave presencial; Único dono";
  assert.deepEqual(parseLegend(text, "moto").unmatched, ["Único dono"]);
  assert.deepEqual(parseLegend("para brisa; para-brisa; Revisado", "carro").unmatched, ["Revisado"]);
  assert.deepEqual(parseLegend("azul-escuro; azul escuro", "carro").unmatched, ["azul-escuro"]);
});

test("sugestões preservam termos alfanuméricos como 4x4 e 4WD", () => {
  for (const category of ["carro", "moto"] as const) {
    const result = parseLegend("4x4; 4WD; 4wd; 2021; 12; de; Revisado", category);
    assert.deepEqual(result.matched, []);
    assert.deepEqual(result.unmatched, ["4x4", "4WD", "Revisado"]);
  }
});

test("mais de 60 presets reconhecidos não liberam sugestões pelo limite negativo", (t) => {
  const presets = getAccessoryPresets("carro") as string[];
  const originalLength = presets.length;
  t.after(() => presets.splice(originalLength));
  const extra = Array.from({ length: 65 }, (_, i) => `Opcional adicional ${i}`);
  presets.push(...extra);
  const result = parseLegend([...extra, "Único dono", "Revisado", "Garantia vigente"].join(";"), "carro");
  assert.equal(result.matched.length, 65);
  assert.deepEqual(result.unmatched, []);
});

test("editar e voltar ao texto original inicia uma nova seleção", (t) => {
  const apply = t.mock.fn(() => true);
  const field = legendField(t, { category: "carro", onApply: apply });
  field.change("ABS; Ar-condicionado");
  field.click("Analisar");
  field.deselect("ABS");
  field.change("ABS; Ar-condicionado novo");
  field.change("ABS; Ar-condicionado");
  field.click("Analisar");
  field.click("Aplicar");
  assert.deepEqual(new Set(apply.mock.calls[0].arguments[0]), new Set(["ABS", "Ar-condicionado"]));
});

test("descartar persiste ao reanalisar e é limpo ao editar o texto", (t) => {
  const apply = t.mock.fn(() => true);
  const field = legendField(t, { onApply: apply });
  field.change("ABS; Revisado na concessionária");
  field.click("Analisar");
  field.click("Descartar");
  field.click("Analisar");
  assert.throws(() => field.click("Adicionar como ponto manual"), /Controle esperado/);
  field.change("ABS; Revisado na concessionária;");
  field.click("Analisar");
  field.click("Adicionar como ponto manual");
  field.click("Aplicar");
  assert.deepEqual(apply.mock.calls[0].arguments, [["ABS"], ["Revisado na concessionária"], undefined]);
});

test("trocar categoria inicia seleção nova em ambas as direções", (t) => {
  const apply = t.mock.fn(() => false);
  const field = legendField(t, { onApply: apply });
  field.change("ABS; Direção elétrica; Bauleto original");
  field.click("Analisar");
  field.deselect("ABS");
  field.props.category = "carro";
  field.click("Analisar");
  field.click("Aplicar");
  assert.deepEqual(new Set(apply.mock.calls[0].arguments[0]), new Set(["ABS", "Direção elétrica"]));
  field.props.category = "moto";
  field.click("Analisar");
  field.click("Aplicar");
  assert.deepEqual(new Set(apply.mock.calls[1].arguments[0]), new Set(["ABS", "Bauleto original"]));
});

test("aplicar limpa texto, seleção e descartes; falha mantém os dados para correção", (t) => {
  let success = false;
  const apply = t.mock.fn(() => success);
  const field = legendField(t, { onApply: apply });
  field.change("ABS; Revisado; Único dono");
  field.click("Analisar");
  field.click("Descartar");
  field.click("Adicionar como ponto manual");
  field.useDescription();
  field.props.description = "";
  field.click("Aplicar");
  assert.equal(field.textarea().value, "ABS; Revisado; Único dono");
  success = true;
  field.click("Aplicar");
  assert.equal(field.textarea().value, "");
  assert.throws(() => field.click("Aplicar"), /Controle esperado/);
  field.change("ABS; Revisado; Único dono");
  field.click("Analisar");
  field.click("Adicionar como ponto manual");
  field.click("Aplicar");
  assert.deepEqual(apply.mock.calls[2].arguments, [["ABS"], ["Revisado"], undefined]);
});
