import assert from "node:assert/strict";
import { test } from "node:test";
import { isValidCpf, maskCpf } from "./format";
import { commercialPdf } from "./commercial-pdf";
import { PDFDocument } from "pdf-lib";

test("CPF confere dígitos verificadores e rejeita repetidos", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224725"), true);
  for (const bad of ["00000000000", "11111111111", "52998224724", "1234567890", ""]) assert.equal(isValidCpf(bad), false);
});

test("CPF mascarado mostra só os dígitos do meio", () => {
  assert.equal(maskCpf("52998224725"), "***.982.247-**");
  assert.equal(maskCpf("123"), "***");
});

test("PDF de recibo gera com número sequencial", async () => {
  const snapshot = { customer: "Ana", cpf: "", phone: "27999999999", vehicle: "Civic", plate: "", amount: 1000, payment: "Pix", conditions: "Complemento", seller: "a@b.c", date: new Date().toISOString() };
  const bytes = await commercialPdf("recibo", snapshot, "abc", 12);
  assert.equal((await PDFDocument.load(bytes)).getTitle(), "Garagem — Recibo nº 12");
});
