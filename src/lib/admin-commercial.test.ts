import assert from "node:assert/strict";
import { test } from "node:test";
import { afterSaleMessage, simulateFinancing, suggestPrice } from "./admin-commercial";
import { commercialPdf } from "./commercial-pdf";
import { PDFDocument } from "pdf-lib";
import { moneyInWords } from "./money-words";

test("Price calcula taxa zero, juros e rejeita valores inválidos", () => {
  assert.deepEqual(simulateFinancing(12000, 2000, 0, 10), { principal: 10000, installment: 1000, total: 12000, interest: 0 });
  assert.equal(simulateFinancing(60000, 10000, 1.5, 48).installment, 1468.75);
  for (const args of [[0, 0, 1, 12], [100, 100, 1, 12], [100, -1, 1, 12], [100, 0, -1, 12], [100, 0, 11, 12], [100, 0, 1, 0], [100, 0, 1, 1.5], [NaN, 0, 1, 12], [Infinity, 0, 1, 12]]) assert.throws(() => simulateFinancing(...args as [number, number, number, number]));
});
test("sugestão respeita custo, FIPE, margem mínima e dias de giro", () => {
  const base = { price: 60000, fipe: 58000, purchase: 50000, costs: 2000, days: 90, margin: 4000, consigned: false };
  assert.equal(suggestPrice(base)?.price, 56000);
  assert.equal(suggestPrice({ ...base, fipe: null, days: 30 })?.price, 59400);
  assert.equal(suggestPrice({ ...base, purchase: null }), null);
  assert.equal(suggestPrice({ ...base, consigned: true }), null);
  assert.equal(suggestPrice({ ...base, fipe: null, days: 0 })?.price, 60000);
});
test("pós-venda usa Garagem, não inclui preço e omite link ausente", () => {
  for (const kind of ["entrega", "satisfacao", "documentacao", "revisao"]) {
    const text = afterSaleMessage(kind, "João", "Civic 2020");
    assert.ok(text.includes("João"));
    assert.ok(!/Sua Garagem|R\$|undefined|\{/.test(text));
  }
  assert.ok(afterSaleMessage("satisfacao", "Ana", "Civic", "https://google.com/test").includes("https://google.com/test"));
});
test("PDF com Sora e Inter preserva acentos e pagina condições longas", async () => {
  const data = { customer: "João Gonçalves", cpf: "", phone: "27999990000", vehicle: "Citroën C3", plate: "ABC1D23", amount: 1234.56, payment: "Pix", conditions: "Condição válida. ".repeat(200), seller: "Vendedor", date: "2026-10-19T12:00:00Z" };
  const bytes = await commercialPdf("proposta", data, "teste-local");
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 2);
  assert.equal(pdf.getTitle(), "Garagem — Contrato de compra e venda");
});
test("recibo de sinal típico cabe em uma página e assina como a empresa", async () => {
  const data = { customer: "João Gonçalves", cpf: "123.456.789-09", phone: "27999990000", vehicle: "Citroën C3", plate: "ABC1D23", amount: 5000, total: 60000, payment: "Pix", conditions: "Reserva por 7 dias.", seller: "vendedor@exemplo.com", date: "2026-10-19T12:00:00Z", year: 2019, yearModel: 2020, color: "Prata", km: 48200 };
  const pdf = await PDFDocument.load(await commercialPdf("recibo", data, "teste-local"));
  assert.equal(pdf.getPageCount(), 1);
  const contrato = await PDFDocument.load(await commercialPdf("proposta", data, "teste-local"));
  assert.equal(contrato.getTitle(), "Garagem — Contrato de compra e venda");
});
test("recibo continua em uma página com os dados no tamanho máximo", async () => {
  const long = "Palavra".repeat(30);
  const base = { cpf: "123.456.789-09", phone: "27999990000", plate: "ABC1D23", amount: 5000, total: 60000, payment: "WWWW ".repeat(40), seller: "x", date: "2026-10-19T12:00:00Z", year: 2019, yearModel: 2020, km: 48200 };
  const wide = (n: number) => "W".repeat(n);
  for (const extra of [
    { customer: "Ana", vehicle: "Citroën C3", color: "Prata", conditions: "Observação longa. ".repeat(170) },
    { customer: long, vehicle: long, color: long, conditions: "x".repeat(3000) },
    { customer: "Nome Sobrenome ".repeat(11), vehicle: "Marca Modelo Versão ".repeat(10), color: "Azul Marinho Metálico", conditions: "Reserva. ".repeat(330) },
    { customer: wide(200), vehicle: wide(200), color: wide(50), conditions: wide(3000), plate: wide(30), cpf: wide(40), phone: wide(40) },
    { customer: "MMMM MMMM ".repeat(20), vehicle: "MMMM MMMM ".repeat(20), color: "MMMM MMMM", conditions: "WWWW ".repeat(600) },
  ]) {
    const pdf = await PDFDocument.load(await commercialPdf("recibo", { ...base, ...extra }, "teste-local"));
    assert.equal(pdf.getPageCount(), 1, extra.customer.slice(0, 12));
  }
});
test("valor por extenso usa 'e' antes da última parte", () => {
  assert.equal(moneyInWords(1_500_000), "um milhão e quinhentos mil reais");
  assert.equal(moneyInWords(1_234_000), "um milhão, duzentos e trinta e quatro mil reais");
  assert.equal(moneyInWords(5000), "cinco mil reais");
});
