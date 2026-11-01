import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, PDFPage, rgb } from "pdf-lib";
import { integerWords } from "./money-words";
import { promissoryClause, promissoryDateInWords, promissoryLongDate, validatePromissory, type PromissoryInput } from "./promissory";
import { promissoryPdf, validatePromissoryPages } from "./promissory-pdf";

const base: PromissoryInput = {
  number: 1, amount: 7000, dueDate: "2026-12-31", issuedAt: "2026-10-29",
  issuer: { name: "Maria de Exemplo", cpf: "52998224725", address: "Rua de Exemplo, 100, Centro, Linhares/ES", birthDate: "1990-01-15", phone: "(27) 99999-0000" },
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

test("promissória: nome e endereço obrigatórios, RG opcional em branco e limites de texto", () => {
  for (const field of ["name", "address"] as const) {
    assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, [field]: " " } }), /emitente/);
  }
  const data = validatePromissory(base);
  assert.equal(data.issuer.rg, "");
  assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, name: "a".repeat(121) } }), /120 caracteres/);
  assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, address: "a\x00b" } }), /Endereço/);
});

test("promissória: nascimento e telefone são obrigatórios", () => {
  for (const field of ["birthDate", "phone"] as const) {
    for (const value of [undefined, "", "   "]) {
      assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, [field]: value } }), /Data de nascimento|Telefone/);
    }
  }
});

test("promissória: nascimento é válido e anterior ou igual à emissão", () => {
  assert.doesNotThrow(() => validatePromissory({ ...base, issuer: { ...base.issuer, birthDate: "1990-01-15" } }));
  assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, birthDate: "1992-02-30" } }), /data válida/);
  assert.throws(() => validatePromissory({ ...base, issuer: { ...base.issuer, birthDate: "2026-10-30" } }), /posterior à emissão/);
});

test("promissória: PDF em uma página A4 contém cláusula, campos e testemunhas sem corte", async () => {
  const drawn: { text: string; x: number; y: number; right: number; font: string }[] = [];
  const lines: Parameters<PDFPage["drawLine"]>[0][] = [];
  const original = PDFPage.prototype.drawText;
  const originalLine = PDFPage.prototype.drawLine;
  PDFPage.prototype.drawText = function (text, options) {
    const x = options?.x ?? 0;
    drawn.push({ text, x, y: options?.y ?? 0, right: x + options!.font!.widthOfTextAtSize(text, options!.size!), font: options!.font!.name });
    return original.call(this, text, options);
  };
  PDFPage.prototype.drawLine = function (options) {
    lines.push(options);
    return originalLine.call(this, options);
  };
  let bytes: Uint8Array;
  try {
    bytes = await promissoryPdf({ ...base, paymentPlace: "Vitória/ES", issuer: { ...base.issuer, rg: "1234567 SSP/ES", birthDate: "1990-01-15", phone: "(27) 99999-0000" } });
  } finally {
    PDFPage.prototype.drawText = original;
    PDFPage.prototype.drawLine = originalLine;
  }
  const pdf = await PDFDocument.load(bytes!);
  assert.equal(pdf.getPageCount(), 1);
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 595.28, height: 841.89 });
  const content = drawn.map(item => item.text).join(" ");
  for (const expected of ["Nº 1 · Via única", "R$ 7.000,00", promissoryClause(base), "Vitória/ES", "Linhares/ES, 29 de outubro de 2026", "Maria de Exemplo", "529.982.247-25", "1234567 SSP/ES", "15/01/1990", "(27) 99999-0000", base.issuer.address, "Assinatura do emitente", "TESTEMUNHA 1", "TESTEMUNHA 2"]) assert.ok(content.includes(expected), expected);
  assert.ok(drawn.every(item => item.x >= 34 && item.right <= 562 && item.y >= 30 && item.y <= 810));
  assert.ok(drawn.find(item => item.text === "Vencimento:")?.font.includes("SemiBold"));
  assert.ok(drawn.find(item => item.text === " 31 de dezembro de 2026")?.font.includes("Regular"));
  const clause = drawn.filter(item => item.y <= 612 && item.y > 540);
  for (const word of ["31", "NOTA", "PROMISSÓRIA", "GARAGEM", "LTDA,", "47.740.076/0001-17,", "7.000,00", "reais)"]) {
    assert.ok(clause.find(item => item.text === word)?.font.includes("SemiBold"), word);
  }
  assert.ok(clause.find(item => item.text === "pagarei")?.font.includes("Regular"));
  for (const label of ["PRAÇA DE PAGAMENTO", "LOCAL E DATA DE EMISSÃO", "EMITENTE", "CPF", "RG / ÓRGÃO EMISSOR", "DATA DE NASCIMENTO", "TELEFONE", "ENDEREÇO DO EMITENTE"]) {
    const field = drawn.find(item => item.text === label)!;
    const underline = lines.find(item => item.start.x === field.x && item.start.y === field.y - 27);
    assert.ok(underline, label);
    assert.equal(underline.end.y, underline.start.y);
    assert.equal(underline.end.x, ["EMITENTE", "ENDEREÇO DO EMITENTE"].includes(label) ? 551.28 : field.x + 243.64);
  }
  for (const label of ["Nome:", "CPF:", "Assinatura:"]) {
    const fields = drawn.filter(item => item.text === label);
    assert.equal(fields.length, 2);
    for (const field of fields) {
      assert.ok(field.font.includes("Regular"));
      assert.ok(lines.some(item => item.start.x === field.x && item.start.y === field.y - 10 && item.end.x === field.x + 243.64 && item.end.y === item.start.y));
    }
  }
  const signatureLine = lines.find(item => item.start.x === 114)!;
  assert.deepEqual(signatureLine.color, rgb(0.051, 0.051, 0.059));
  assert.ok(!content.includes("________________________"));
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


test("pré-validação usa o A4 real e rejeita textos aceitos pelo formulário que excedem a página", async () => {
  const input = { ...base, amount: 999999.99, issuePlace: "W".repeat(100), paymentPlace: "W".repeat(100), issuer: { ...base.issuer, name: "W".repeat(120), rg: "W".repeat(60), address: "W".repeat(240) } };
  assert.doesNotThrow(() => validatePromissory(input));
  await assert.rejects(validatePromissoryPages([input]), /excedem.*A4/);
  await validatePromissoryPages([base, { ...base, dueDate: "2027-02-28" }]);
});

test("nota paga imprime quitação, data e reimpressão histórica sem nova promessa de pagamento", async () => {
  const texts: string[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) { texts.push(text); return original.call(this, text, options); };
  try { await promissoryPdf({ ...base, status: "paga", paidAt: "2026-11-01T02:00:00.000Z" }); }
  finally { PDFPage.prototype.drawText = original; }
  const text = texts.join(" ");
  assert.match(text, /QUITADA/);
  assert.match(text, /Reimpressão histórica/);
  assert.match(text, /31\/10\/2026/);
  assert.doesNotMatch(text, /Via única|pagarei por esta/);
});
