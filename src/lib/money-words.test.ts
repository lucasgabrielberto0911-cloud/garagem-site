import assert from "node:assert/strict";
import test from "node:test";
import { moneyInWords } from "./money-words";

test("valor por extenso em reais", () => {
  assert.equal(moneyInWords(0), "zero reais");
  assert.equal(moneyInWords(1), "um real");
  assert.equal(moneyInWords(100), "cem reais");
  assert.equal(moneyInWords(5000), "cinco mil reais");
  assert.equal(moneyInWords(1500), "mil e quinhentos reais");
  assert.equal(moneyInWords(118900), "cento e dezoito mil e novecentos reais");
  assert.equal(moneyInWords(2000000), "dois milhões de reais");
  assert.equal(moneyInWords(1250.5), "mil, duzentos e cinquenta reais e cinquenta centavos");
  assert.equal(moneyInWords(0.01), "um centavo");
});
