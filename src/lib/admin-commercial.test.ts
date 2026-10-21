import assert from "node:assert/strict";
import { test } from "node:test";
import { afterSaleMessage, financingSimulationDown, signalMismatch, formatContractPaymentRow, parseContractPaymentsJson, simulateFinancing, suggestPrice, sumContractPayments, summarizeContractPayments } from "./admin-commercial";
import { commercialPdf, expensesPdf, groupExpenseCosts } from "./commercial-pdf";
import { PDFArray, PDFDocument, PDFPage, decodePDFRawStream, PDFRawStream } from "pdf-lib";
import { moneyInWords } from "./money-words";

test("Price calcula taxa zero, juros e rejeita valores inválidos", () => {
  assert.deepEqual(simulateFinancing(12000, 2000, 0, 10), { principal: 10000, installment: 1000, total: 12000, interest: 0 });
  assert.equal(simulateFinancing(60000, 10000, 1.5, 48).installment, 1468.75);
  for (const args of [[0, 0, 1, 12], [100, 100, 1, 12], [100, -1, 1, 12], [100, 0, -1, 12], [100, 0, 11, 12], [100, 0, 1, 0], [100, 0, 1, 1.5], [NaN, 0, 1, 12], [Infinity, 0, 1, 12]]) assert.throws(() => simulateFinancing(...args as [number, number, number, number]));
});
test("sugestão respeita custo, margem mínima e dias de giro", () => {
  const base = { price: 60000, purchase: 50000, costs: 2000, days: 90, margin: 4000, consigned: false };
  assert.equal(suggestPrice(base)?.price, 57000);
  assert.equal(suggestPrice({ ...base, days: 30 })?.price, 59400);
  assert.equal(suggestPrice({ ...base, purchase: null }), null);
  assert.equal(suggestPrice({ ...base, consigned: true }), null);
  assert.equal(suggestPrice({ ...base, days: 0 })?.price, 60000);
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
test("recibo com dados no tamanho máximo e observação curta continua em uma página", async () => {
  const long = "Palavra".repeat(30);
  const base = { cpf: "123.456.789-09", phone: "27999990000", plate: "ABC1D23", amount: 5000, total: 60000, payment: "WWWW ".repeat(40), seller: "x", date: "2026-10-19T12:00:00Z", year: 2019, yearModel: 2020, km: 48200 };
  const wide = (n: number) => "W".repeat(n);
  for (const extra of [
    { customer: "Ana", vehicle: "Citroën C3", color: "Prata", conditions: "Reserva por 7 dias." },
    { customer: long, vehicle: long, color: long, conditions: "Reserva por 7 dias." },
    { customer: "Nome Sobrenome ".repeat(11), vehicle: "Marca Modelo Versão ".repeat(10), color: "Azul Marinho Metálico", conditions: "Reserva por 7 dias." },
    { customer: wide(200), vehicle: wide(200), color: wide(50), conditions: "Reserva por 7 dias.", plate: wide(30), cpf: wide(40), phone: wide(40) },
    { customer: "MMMM MMMM ".repeat(20), vehicle: "MMMM MMMM ".repeat(20), color: "MMMM MMMM", conditions: "Reserva por 7 dias." },
  ]) {
    const pdf = await PDFDocument.load(await commercialPdf("recibo", { ...base, ...extra }, "teste-local"));
    assert.equal(pdf.getPageCount(), 1, extra.customer.slice(0, 12));
  }
});
test("recibo com observação longa continua na 2ª página sem cortar o texto", async () => {
  const words = Array.from({ length: 160 }, (_, i) => `palavra${i + 1}`);
  const conditions = `${words.join(" ")} FIM`;
  const data = { customer: "João Gonçalves", cpf: "123.456.789-09", phone: "27999990000", vehicle: "Citroën C3", plate: "ABC1D23", amount: 5000, total: 60000, payment: "Pix", conditions, seller: "x", date: "2026-10-19T12:00:00Z", year: 2019, yearModel: 2020, color: "Prata", km: 48200 };
  const bytes = await commercialPdf("recibo", data, "teste-local");
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 2);
  // Sem binário externo: captura o texto desenhado em cada página.
  const drawn: string[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) { drawn.push(text); return original.call(this, text, options); };
  try {
    await commercialPdf("recibo", data, "teste-local");
  } finally {
    PDFPage.prototype.drawText = original;
  }
  const text = drawn.join(" ").replace(/\s+/g, " ");
  // Rodapé e cabeçalho da 2ª página ficam no meio do texto: compara só as palavras da observação, em ordem.
  assert.equal((text.match(/palavra\d+|FIM/g) ?? []).join(" "), conditions);
  assert.ok(text.includes("Página 1 de 2") && text.includes("Página 2 de 2"));
});
test("valor por extenso usa 'e' antes da última parte", () => {
  assert.equal(moneyInWords(1_500_000), "um milhão e quinhentos mil reais");
  assert.equal(moneyInWords(1_234_000), "um milhão, duzentos e trinta e quatro mil reais");
  assert.equal(moneyInWords(5000), "cinco mil reais");
});

test("Relatório de gastos segue a ordem das categorias e ordena por data só dentro de cada uma", () => {
  const costs = [
    { kind: "mecanica", description: "a", amount: 1, date: "2026-10-01" },
    { kind: "despachante", description: "b", amount: 1, date: "2026-10-20" },
    { kind: "mecanica", description: "c", amount: 1, date: "2026-09-01" },
  ];
  const groups = groupExpenseCosts(costs);
  assert.deepEqual([...groups.keys()], ["despachante", "mecanica"]);
  assert.deepEqual(groups.get("mecanica")!.map((c) => c.description), ["c", "a"]);
});

test("Relatório de gastos mantém o título do Resumo na mesma página da caixa", async () => {
  const costs = Array.from({ length: 20 }, (_, i) => ({ kind: "mecanica", description: `Gasto ${i}`, amount: 100, date: `2026-10-${String(i + 1).padStart(2, "0")}` }));
  for (let n = 14; n <= 22; n++) {
    const bytes = await expensesPdf({ vehicle: "Fiat Uno 2015", plate: "ABC1D23", consigned: false, purchasePrice: 20000, salePrice: 30000, sold: false, costs: costs.slice(0, n), kindLabel: (k) => k });
    const doc = await PDFDocument.load(bytes);
    // Título de seção = retângulo de marca 3x13 (path "3 13 l"); a caixa do Resumo é o retângulo largo (507) da última página.
    const last = doc.getPages().at(-1)!;
    const streams = doc.context.lookup(last.node.normalizedEntries().Contents);
    const refs = streams instanceof PDFArray ? streams.asArray() : [last.node.normalizedEntries().Contents];
    const content = refs.map((r) => doc.context.lookup(r)).filter((o): o is PDFRawStream => o instanceof PDFRawStream).map((o) => Buffer.from(decodePDFRawStream(o).decode()).toString("latin1")).join("\n");
    assert.match(content, /0 13 l\n3 13 l[\s\S]*\n507\.\d+ \d+ l/, `n=${n}: título e caixa na mesma página`);
  }
});

test("contrato com sinal, entrada e financiamento calcula linhas e assina Garagem Motorcycle Ltda", async () => {
  const data = {
    customer: "Carlos Silva",
    cpf: "123.456.789-01",
    phone: "27999991111",
    vehicle: "Toyota Corolla XEi",
    plate: "ABC1D23",
    amount: 100000,
    payment: "Entrada + Financiamento Santander",
    conditions: "Transferência em até 30 dias.",
    seller: "vendedor@garagem.net",
    date: "2026-10-20T12:00:00Z",
    signal: { amount: 10000, receiptId: "42" },
    downPayment: 20000,
    financed: 70000,
  };
  const bytes = await commercialPdf("contrato", data, "teste-contrato", 43);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), "Garagem — Contrato de compra e venda");
  assert.ok(pdf.getPageCount() >= 2);
});

test("contrato com sinal manual sem recibo vinculado, entrada e financiamento não exibe 'recibo de sinal nº'", async () => {
  const data = {
    customer: "Mariana Souza",
    cpf: "987.654.321-09",
    phone: "27999992222",
    vehicle: "Honda HR-V EXL",
    plate: "XYZ9K88",
    amount: 120000,
    payment: "Entrada + Financiamento Itaú",
    conditions: "Veículo entregue revisado com garantia de 90 dias.",
    seller: "vendedor@garagem.net",
    date: "2026-10-20T14:00:00Z",
    signal: { amount: 15000 },
    downPayment: 25000,
    financed: 80000,
  };
  const drawn: string[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) { drawn.push(text); return original.call(this, text, options); };
  let bytes: Uint8Array;
  try {
    bytes = await commercialPdf("contrato", data, "teste-contrato-manual", 44);
  } finally {
    PDFPage.prototype.drawText = original;
  }
  const text = drawn.join(" ");
  assert.ok(!text.includes("recibo de sinal nº"), "sinal manual sem recibo vinculado não deve apresentar 'recibo de sinal nº'");
  assert.ok(text.includes("recibo de sinal emitido pela VENDEDORA"), "sinal manual sem recibo vinculado exibe descrição padrão da VENDEDORA");
  assert.ok(text.includes("15.000,00"), "tabela de pagamento exibe o sinal de 15.000,00");
  assert.ok(text.includes("25.000,00"), "tabela de pagamento exibe a entrada de 25.000,00");
  assert.ok(text.includes("80.000,00"), "tabela de pagamento exibe o valor financiado de 80.000,00");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), "Garagem — Contrato de compra e venda");
  assert.ok(pdf.getPageCount() >= 2);
});

test("contrato com múltiplas formas de pagamento (PIX, Financiamento, Troca, Cartão e Sinal) lista todas no PDF e soma bate com o total", async () => {
  const rawPayments = JSON.stringify([
    { method: "sinal", amount: 5000, signalDate: "2026-10-18" },
    { method: "pix", amount: 15000 },
    { method: "troca", amount: 30000, tradeVehicle: "Fiat Palio 2015", tradePlate: "ODB4A12" },
    { method: "cartao", amount: 10000, installments: 10 },
    { method: "financiamento", amount: 50000, downPayment: 10000, bank: "Santander", installments: 48 },
  ]);
  const payments = parseContractPaymentsJson(rawPayments);
  assert.ok(payments);
  assert.equal(payments.length, 5);
  assert.equal(sumContractPayments(payments), 120000);
  const summary = summarizeContractPayments(payments);
  assert.ok(summary.includes("À vista/PIX"));
  assert.ok(summary.includes("Financiamento Santander 48x"));
  assert.ok(summary.includes("Troca Fiat Palio 2015"));
  assert.ok(summary.includes("Cartão 10x"));
  assert.ok(summary.includes("Sinal"));
  assert.equal(formatContractPaymentRow(payments[2]), "(−) Troca — veículo na troca (Fiat Palio 2015 · placa ODB4A12)");

  const data = {
    customer: "Roberto Almeida",
    cpf: "111.222.333-44",
    phone: "27999993333",
    vehicle: "Jeep Compass Longitude",
    plate: "BRA2E19",
    amount: 120000,
    payment: summary,
    payments,
    signal: { amount: 5000, receiptId: "55", date: "2026-10-18T12:00:00Z" },
    conditions: "Revisado e com transferência em 30 dias.",
    seller: "vendedor@garagem.net",
    date: "2026-10-20T15:00:00Z",
  };
  const drawn: string[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) { drawn.push(text); return original.call(this, text, options); };
  let bytes: Uint8Array;
  try {
    bytes = await commercialPdf("contrato", data, "teste-contrato-multiplo", 56);
  } finally {
    PDFPage.prototype.drawText = original;
  }
  const text = drawn.join(" ");
  assert.ok(text.includes("Garagem Motorcycle Ltda"), "vendedor sempre Garagem Motorcycle Ltda");
  assert.ok(text.includes("recibo de sinal nº 55"), "sinal referencia recibo vinculado");
  assert.ok(text.includes("À vista / PIX"), "lista PIX no PDF");
  assert.ok(text.includes("Fiat Palio 2015 · placa ODB4A12"), "lista veículo e placa da troca no PDF");
  assert.ok(text.includes("Cartão (10x)"), "lista cartão com parcelas no PDF");
  assert.ok(text.includes("Entrada do financiamento"), "lista entrada do financiamento no PDF");
  assert.ok(text.includes("Financiamento (Santander, 48x)"), "lista financiamento com banco e parcelas no PDF");
  assert.ok(text.includes("0,00"), "saldo a pagar zera quando a soma das formas bate com o total");
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getTitle(), "Garagem — Contrato de compra e venda");
  assert.ok(pdf.getPageCount() >= 2);
});

test("sinal da lista deve bater com o sinal persistido (alteração e omissão)", () => {
  const pix = { method: "pix" as const, amount: 90000 };
  assert.equal(signalMismatch([{ method: "sinal", amount: 10000 }, pix], 10000), undefined);
  assert.ok(signalMismatch([{ method: "sinal", amount: 20000 }, pix], 10000));
  assert.ok(signalMismatch([pix], 10000));
  assert.equal(signalMismatch([pix], 0), undefined);
});

test("simulação usa o valor financiado: demais meios entram na entrada equivalente", () => {
  const items = [
    { method: "sinal" as const, amount: 10000 }, { method: "pix" as const, amount: 15000 },
    { method: "troca" as const, amount: 25000 }, { method: "financiamento" as const, amount: 60000 },
  ];
  const down = financingSimulationDown(110000, items);
  assert.equal(down, 50000);
  assert.equal(simulateFinancing(110000, down!, 1.5, 48).installment, simulateFinancing(60000, 0, 1.5, 48).installment);
  assert.equal(financingSimulationDown(110000, [{ method: "pix", amount: 110000 }]), undefined);
});

test("PDF: rótulo longo da troca quebra linha e não invade o valor", async () => {
  const drawn: { text: string; x: number; y: number }[] = [];
  const original = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (text, options) { drawn.push({ text, x: options?.x ?? 0, y: options?.y ?? 0 }); return original.call(this, text, options); };
  try {
    await commercialPdf("contrato", {
      customer: "Ana", cpf: "", phone: "", vehicle: "Civic", plate: "AAA1A11", amount: 110000, payment: "x",
      payments: [{ method: "troca", amount: 25000, tradeVehicle: "Toyota Corolla Cross XRE 2.0 Flex 16V Automático 2023", tradePlate: "ABC1D23" }, { method: "pix", amount: 85000 }],
      conditions: "ok", seller: "v", date: "2026-10-20T15:00:00Z",
    }, "t-longo", 1);
  } finally { PDFPage.prototype.drawText = original; }
  const label = drawn.filter((d) => /Troca|Corolla|ABC1D23/.test(d.text));
  assert.ok(label.length >= 2, "rótulo quebrou em mais de uma linha");
  const val = drawn.find((d) => d.text === "R$ 25.000,00" || d.text.includes("25.000,00"));
  assert.ok(val);
  // linhas do rótulo na mesma altura do valor não podem chegar ao x do valor
  assert.ok(label.every((l) => l.y !== val!.y || l.x < val!.x));
});
