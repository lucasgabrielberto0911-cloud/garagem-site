import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFPage } from "pdf-lib";
import { commercialPdf, PDF_STORE, type DocumentSnapshot } from "./commercial-pdf";

const base: DocumentSnapshot = {
  customer: "Maria Souza", cpf: "52998224725", phone: "27999999999", vehicle: "Fiat Argo", plate: "ABC1D23",
  amount: 1000, payment: "Pix", conditions: "", seller: "x@y.z", date: new Date().toISOString(),
};

async function pages(kind: string, data: DocumentSnapshot) {
  const out = await commercialPdf(kind, data, "id1", 1);
  const bytes = out instanceof Uint8Array ? out : new Uint8Array((out as { bytes: ArrayBuffer }).bytes ?? (out as ArrayBuffer));
  return (await PDFDocument.load(bytes)).getPageCount();
}

test("recibo: observação longa vai para a 2ª página, sem cortar", async () => {
  const short = await pages("recibo", base);
  const long = await pages("recibo", { ...base, conditions: "Observação muito longa. ".repeat(150) });
  assert.equal(short, 1);
  assert.ok(long >= 2);
});

test("contrato aceita a garantia da ficha", async () => {
  assert.ok((await pages("contrato", { ...base, amount: 50000, total: 50000, warranty: "3 meses de motor e câmbio" })) >= 1);
});

test("contrato informa endereço cadastral na cláusula, sem alterar cabeçalho", async () => {
  const drawn: { text: string; y: number }[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) {
    drawn.push({ text, y: options.y });
    return original.call(this, text, options);
  };
  try {
    await commercialPdf("contrato", { ...base, amount: 50000, total: 50000 }, "id1", 1);
  } finally {
    PDFPage.prototype.drawText = original;
  }

  const clause = drawn.filter(({ y }) => y < 730).map(({ text }) => text).join(" ");
  const header = drawn.filter(({ y }) => y >= 730).map(({ text }) => text).join(" ");
  assert.ok(clause.includes(`com sede em ${PDF_STORE.registeredAddress}`));
  assert.ok(!clause.includes(`${PDF_STORE.registeredAddress}, ${PDF_STORE.city}/${PDF_STORE.stateCode}`));
  assert.ok(!header.includes(PDF_STORE.registeredAddress));
});
