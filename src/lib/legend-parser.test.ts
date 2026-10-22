import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLegend } from "./legend-parser";
import { getAccessoryPresets, normalizeAccessories, filterAccessoriesForCategory } from "./vehicle-accessories";

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
  assert.deepEqual(result.unmatched, ["GARAGEM", "Único dono", "Revisões na concessionária"]);
  assert.equal(result.fullText, text);
});

test("cada categoria reconhece somente seus presets; maior preset não duplica o menor", () => {
  const result = parseLegend("Direção elétrica; ABS; painel digital TFT; bauleto original; freio a disco (dianteiro e traseiro)", "moto");
  assert.deepEqual(new Set(result.matched), new Set(["ABS", "Painel digital TFT", "Bauleto original", "Freio a disco (dianteiro e traseiro)"]));
  assert.deepEqual(result.unmatched, ["Direção elétrica"]);
  for (const category of ["carro", "moto"] as const) {
    for (const preset of getAccessoryPresets(category)) {
      assert.deepEqual(parseLegend(preset, category), { matched: [preset], unmatched: [], fullText: preset });
    }
  }
});

test("vazio, emoji e URLs não geram itens nem reconhecem termos dentro de URLs", () => {
  for (const text of ["", "  \n ", "🚗🔥✅", "https://exemplo.com/abs/alarme", "www.exemplo.com/led"]) {
    assert.deepEqual(parseLegend(text, "carro"), { matched: [], unmatched: [], fullText: text });
  }
});

test("deduplica presets e pontos manuais sem acento e limita a 60 itens", () => {
  const result = parseLegend("ABS; abs; Único dono; unico dono; " + Array.from({ length: 80 }, (_, i) => `Ponto manual ${i}`).join(";"), "carro");
  assert.deepEqual(result.matched, ["ABS"]);
  assert.equal(result.unmatched[0], "Único dono");
  assert.equal(result.matched.length + result.unmatched.length, 60);
});

test("merge preserva existentes, deduplica e filtra a categoria antes do teto", () => {
  const parsed = parseLegend("ABS; Painel digital; Único dono", "moto");
  const merged = normalizeAccessories(filterAccessoriesForCategory([
    "Pneus novos", "ABS", "Direção elétrica", ...parsed.matched, ...parsed.unmatched,
  ], "moto"));
  assert.deepEqual(merged, ["Pneus novos", "ABS", "Painel digital", "Único dono"]);
});
