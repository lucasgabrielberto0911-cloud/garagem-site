import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { commercialPdf, type DocumentSnapshot } from "./commercial-pdf";

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
