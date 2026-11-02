import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFPage } from "pdf-lib";
import { commercialPdf, preparationPdf, PDF_STORE, type DocumentSnapshot } from "./commercial-pdf";

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
    drawn.push({ text, y: options?.y ?? 0 });
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

test("PDF de preparação quebra palavras longas sem cortar o conteúdo e usa a capacidade por página", async () => {
  const drawn: { text: string; x: number; font: NonNullable<Parameters<PDFPage["drawText"]>[1]>["font"] }[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) {
    drawn.push({ text, x: options?.x ?? 0, font: (options && options.font) as NonNullable<Parameters<PDFPage["drawText"]>[1]>["font"] });
    return original.call(this, text, options);
  };
  let bytes: Uint8Array;
  try {
    bytes = await preparationPdf(Array.from({ length: 35 }, (_, i) => ({
      brand: "Toyota", model: `Carro ${i}`,
      ready: false, posted: false,
    })), new Date("2026-10-21T12:00:00Z"));
    drawn.length = 0;
    await preparationPdf([{ brand: "Toyota", model: "Hilux SW4 SRX Diamond 2.8 4x4 Turbo Diesel Automático 7 Lugares SW4/SRX/DIAMOND/2.8/4X4/TURBO/DIESEL/AUTOMATICO", ready: false, posted: false }], new Date("2026-10-21T12:00:00Z"));
  } finally {
    PDFPage.prototype.drawText = original;
  }
  assert.equal((await PDFDocument.load(bytes!)).getPageCount(), 2);
  const modelX = 28 + 65 + 3;
  const modelLines = drawn.filter(({ x }) => x === modelX).map(({ text }) => text);
  assert.ok(modelLines.some(text => text.includes("Lugares")));
  const longWordLines = modelLines.filter(text => /^[A-Z0-9./]+$/.test(text) && text.includes("/"));
  assert.ok(longWordLines.length > 1);
  assert.ok(longWordLines.every(text => (drawn.find(item => item.text === text && item.x === modelX)?.font?.widthOfTextAtSize(text, 7) ?? 0) <= 104));
});

test("contrato: cláusula de promissórias traz todas as notas, valores e vencimentos e pagina lotes longos", async () => {
  const drawn: { text: string; y: number }[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) {
    drawn.push({ text, y: options?.y ?? 0 });
    return original.call(this, text, options);
  };
  const notes = Array.from({ length: 60 }, (_, index) => ({ id: `nota-${index}`, number: index + 1, amount: 100.01, dueDate: "2027-01-31" }));
  try {
    const count = await pages("contrato", { ...base, amount: 6000.60, total: 6000.60, payments: [{ method: "promissoria", amount: 6000.60, noteIds: notes.map((note) => note.id), notes }] });
    assert.ok(count >= 3);
  } finally { PDFPage.prototype.drawText = original; }
  const text = drawn.map((item) => item.text).join(" ");
  for (const note of notes) assert.ok(text.includes(`Nota promissória nº ${note.number} ·`));
  assert.ok(text.includes("100,01"));
  assert.ok(text.includes("31/01/2027"));
  assert.ok(text.includes("não representa quitação"));
  assert.ok(drawn.every((item) => item.y >= 15), "nenhum texto abaixo da página");
});


test("proposta tem conteúdo próprio, sem cláusulas ou assinatura contratual", async () => {
  const drawn: string[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) { drawn.push(text); return original.call(this, text, options); };
  try {
    const bytes = await commercialPdf("proposta", { ...base, payments: [{ method: "pix", amount: 1000 }], conditions: "Validade de três dias." }, "proposta-ficticia", 9);
    assert.match((await PDFDocument.load(bytes)).getTitle()!, /Proposta comercial/);
  } finally { PDFPage.prototype.drawText = original; }
  const text = drawn.join(" ");
  assert.match(text, /PROPOSTA COMERCIAL/);
  assert.match(text, /não registra aceite, pagamento, quitação ou transferência/);
  assert.match(text, /Validade de três dias/);
  assert.doesNotMatch(text, /justo e contratado|CLÁUSULA|Contrato de compra e venda|TESTEMUNHA|Rubrique/);
});

test("reimpressão usa identificação da loja preservada na emissão", async () => {
  const drawn: string[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) { drawn.push(text); return original.call(this, text, options); };
  try {
    await commercialPdf("contrato", { ...base, store: { ...PDF_STORE, version: 1, legalName: "Loja Fictícia Original", cnpj: "00.000.000/0001-00", city: "Cidade Fictícia", address: "Rua Fictícia, 1", registeredAddress: "Sede Fictícia Original", whatsappLabel: "(00) 00000-0000", email: "original@local.test" } }, "historico", 1);
  } finally { PDFPage.prototype.drawText = original; }
  const text = drawn.join(" ");
  for (const expected of ["Loja Fictícia Original", "Sede Fictícia Original", "Rua Fictícia, 1", "original@local.test", "Cidade Fictícia"]) assert.ok(text.includes(expected), expected);
  assert.ok(!text.includes(PDF_STORE.legalName));
});
