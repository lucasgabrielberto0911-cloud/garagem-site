import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, PDFPage } from "pdf-lib";
import { integerWords } from "./money-words";
import { promissoryClause, promissoryDateInWords, promissoryLongDate, validatePromissory, type PromissoryInput } from "./promissory";
import { promissoryPdf } from "./promissory-pdf";

const base: PromissoryInput = {
  number: 1, amount: 7000, dueDate: "2026-12-31", issuedAt: "2026-10-29",
  issuer: { name: "Maria de Exemplo", cpf: "52998224725", address: "Rua de Exemplo, 100, Centro, Linhares/ES" },
};

test("promissória: cláusula segue o modelo e mantém o beneficiário fixo", () => {
  assert.equal(promissoryClause(base), "Aos 31 (trinta e um) dias do mês de dezembro do ano de 2026 (dois mil e vinte e seis), pagarei por esta única via de NOTA PROMISSÓRIA a GARAGEM MOTORCYCLE LTDA, inscrita no CNPJ sob o nº 47.740.076/0001-17, ou à sua ordem, a quantia de R$ 7.000,00 (sete mil reais) em moeda corrente deste país.");
});

test("promissória: extenso de reais, singular, cem e centavos", () => {
  for (const [amount, expected] of [[1, "um real"], [100, "cem reais"], [0.01, "um centavo"], [1.01, "um real e um centavo"], [7000.52, "sete mil reais e cinquenta e dois centavos"], [2_000_000, "dois milhões de reais"], [0.29, "vinte e nove centavos"]] as const) {
    assert.ok(promissoryClause({ ...base, amount }).includes(`(${expected})`));
  }
  assert.equal(integerWords(100), "cem");
  assert.equal(integerWords(2026), "dois mil e vinte e seis");
});

test("promissória: datas por extenso, incluindo primeiro dia e ano", () => {
  assert.equal(promissoryDateInWords("2026-12-31"), "31 (trinta e um) dias do mês de dezembro do ano de 2026 (dois mil e vinte e seis)");
  assert.equal(promissoryLongDate("2026-12-31"), "31 de dezembro de 2026");
  assert.ok(promissoryClause({ ...base, dueDate: "2027-01-01" }).startsWith("Ao 1 (um) dia do mês de janeiro do ano de 2027 (dois mil e vinte e sete)"));
  assert.equal(promissoryLongDate("2028-02-29"), "29 de fevereiro de 2028");
});

test("promissória: rejeita datas inexistentes e formatos com horário", () => {
  for (const invalid of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-01-00", "31/12/2026", "2026-1-01", "2026-12-31T00:00:00Z", "0000-01-01", ""]) {
    assert.throws(() => promissoryDateInWords(invalid), /data válida/);
    assert.throws(() => validatePromissory({ ...base, dueDate: invalid }), /data válida/);
    assert.throws(() => validatePromissory({ ...base, issuedAt: invalid }), /data válida/);
  }
});

test("promissória: vencimento anterior à emissão é inválido; mesmo dia e nota histórica são aceitos", () => {
  assert.throws(() => validatePromissory({ ...base, dueDate: "2026-10-28" }), /anterior à emissão/);
  assert.doesNotThrow(() => validatePromissory({ ...base, dueDate: base.issuedAt }));
  assert.doesNotThrow(() => validatePromissory({ ...base, issuedAt: "2020-01-01", dueDate: "2020-02-01" }));
});

test("promissória: rejeita CPF inválido, repetido e texto misturado ao CPF", () => {
  for (const cpf of ["", "11111111111", "52998224724", "5299822472", "52998224725abc"]) {
    assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, cpf } }), /CPF/);
  }
  assert.equal(validatePromissory(base).issuer.cpf, "529.982.247-25");
  assert.equal(validatePromissory({ ...base, issuer: { ...base.issuer, cpf: "529.982.247-25" } }).issuer.cpf, "529.982.247-25");
});

test("promissória: valor positivo, finito, limitado e em centavos", () => {
  for (const amount of [0, -1, NaN, Infinity, 0.001, 1e-20, 1.999, 10_000_000_000]) {
    assert.throws(() => validatePromissory({ ...base, amount }), /valor positivo/);
  }
  assert.equal(validatePromissory({ ...base, amount: 0.1 + 0.2 }).amount, 0.3);
  assert.equal(validatePromissory({ ...base, amount: 9_999_999_999.99 }).amount, 9_999_999_999.99);
});

test("promissória: número opcional ou inteiro positivo", () => {
  assert.doesNotThrow(() => validatePromissory({ ...base, number: undefined }));
  for (const number of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validatePromissory({ ...base, number }), /número da nota/);
});

test("promissória: praça e emissão usam Linhares/ES e permitem parâmetro independente", () => {
  const data = validatePromissory(base);
  assert.equal(data.paymentPlace, "Linhares/ES");
  assert.equal(data.issuePlace, "Linhares/ES");
  const changed = validatePromissory({ ...base, paymentPlace: " Vitória/ES ", issuePlace: "Serra/ES" });
  assert.equal(changed.paymentPlace, "Vitória/ES");
  assert.equal(changed.issuePlace, "Serra/ES");
  assert.throws(() => validatePromissory({ ...base, paymentPlace: " " }), /Praça de pagamento/);
});

test("promissória: nome e endereço obrigatórios, campos opcionais em branco e limites de texto", () => {
  for (const field of ["name", "address"] as const) {
    assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, [field]: " " } }), /emitente/);
  }
  const data = validatePromissory(base);
  assert.equal(data.issuer.rg, "");
  assert.equal(data.issuer.birthDate, "");
  assert.equal(data.issuer.phone, "");
  assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, name: "a".repeat(121) } }), /120 caracteres/);
  assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, address: "a\x00b" } }), /Endereço/);
});

test("promissória: nascimento é opcional, válido e anterior ou igual à emissão", () => {
  assert.doesNotThrow(() => validatePromissory({ ...base, issuer: { ...base.issuer, birthDate: "1992-11-05" } }));
  assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, birthDate: "1992-02-30" } }), /data válida/);
  assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, birthDate: "2026-10-30" } }), /posterior à emissão/);
});

test("promissória: PDF em uma página A4 contém cláusula, campos e testemunhas sem corte", async () => {
  const drawn: { text: string; x: number; y: number; right: number }[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) {
    const x = options?.x ?? 0;
    drawn.push({ text, x, y: options?.y ?? 0, right: x + options!.font!.widthOfTextAtSize(text, options!.size!) });
    return original.call(this, text, options);
  };
  let bytes: Uint8Array;
  try {
    bytes = await promissoryPdf({ ...base, paymentPlace: "Vitória/ES", issuer: { ...base.issuer, rg: "1234567 SSP/ES", birthDate: "1992-11-05", phone: "(27) 99999-0000" } });
  } finally {
    PDFPage.prototype.drawText = original;
  }
  const pdf = await PDFDocument.load(bytes!);
  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 595.28, height: 841.89 });
  const content = drawn.map(item => item.text).join(" ");
  for (const expected of ["Nº 1 · Via única", "R$ 7.000,00", promissoryClause(base), "Vitória/ES", "Linhares/ES, 29 de outubro de 2026", "Maria de Exemplo", "529.982.247-25", "1234567 SSP/ES", "05/11/1992", "(27) 99999-0000", base.issuer.address, "Assinatura do emitente", "TESTEMUNHA 1", "TESTEMUNHA 2"]) assert.ok(content.includes(expected), expected);
  assert.ok(drawn.every(item => item.x >= 34 && item.right <= 562 && item.y >= 30 && item.y <= 810));
});

test("promissória: PDF recusa dados inválidos antes de emitir", async () => {
  await assert.rejects(promissoryPdf({ ...base, amount: -1 }), /valor positivo/);
});

test("promissória: PDF recusa excesso de conteúdo em vez de cortar a via única", async () => {
  await assert.rejects(promissoryPdf({
    ...base, amount: 9_999_999_999.99,
    issuePlace: "W".repeat(100), paymentPlace: "W".repeat(100),
    issuer: { ...base.issuer, name: "W".repeat(120), address: "W".repeat(240), rg: "W".repeat(60), phone: "W".repeat(30) },
  }), /excedem o espaço de uma página A4/);
});
