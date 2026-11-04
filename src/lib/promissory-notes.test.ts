import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import {
  addDaysCivil, addMonthsClamped, canCancelPromissory, canMarkPromissoryPaid, dateOnly, describePromissoryDue, formatCivilDate,
  nextMonthDayCivil, normalizePromissoryPhone, parsePromissoryDueFilter, parsePromissoryFilter, parsePromissoryForm,
  parsePromissoryStatus, promissoryListWhere, promissoryInstallmentDates, promissoryPaidNotice, promissoryRowToPdfInput,
  type PromissoryFormFields,
} from "./promissory-notes";
import { promissoryBatchPdf, promissoryPdf } from "./promissory-pdf";

const today = "2026-10-29";
const form: Partial<PromissoryFormFields> = {
  name: "Maria de Exemplo", cpf: "529.982.247-25", birthDate: "1985-03-12", phone: "(27) 99999-0000",
  address: "Rua de Exemplo, 100, Centro, Linhares/ES", amount: "1.500,00", count: "6", firstDueDate: "2026-11-30",
};

test("promissórias: vencimentos mensais mantêm o dia e usam o último dia em mês curto", () => {
  assert.deepEqual(promissoryInstallmentDates("2026-11-30", 4), ["2026-11-30", "2026-12-30", "2027-01-30", "2027-02-28"]);
  assert.deepEqual(promissoryInstallmentDates("2027-01-31", 4), ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
  assert.equal(addMonthsClamped("2028-01-31", 1), "2028-02-29");
  assert.equal(addMonthsClamped("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonthsClamped("2026-12-15", 13), "2028-01-15");
  assert.throws(() => promissoryInstallmentDates("2026-11-30", 0));
  assert.throws(() => promissoryInstallmentDates("2026-11-30", 61));
  assert.throws(() => addMonthsClamped("30/11/2026", 1));
});

test("promissórias: formulário válido gera as parcelas com praça padrão em Linhares/ES", () => {
  const result = parsePromissoryForm(form, today);
  assert.ok(result.ok);
  assert.equal(result.installments.length, 6);
  assert.deepEqual(result.installments[0], { installmentNo: 1, installmentCount: 6, amount: 1500, dueDate: "2026-11-30" });
  assert.equal(result.installments[5].dueDate, "2027-04-30");
  assert.equal(result.issuedAt, today);
  assert.equal(result.issuePlace, "Linhares/ES");
  assert.equal(result.paymentPlace, "Linhares/ES");
  assert.equal(result.issuer.cpf, "529.982.247-25");
  assert.equal(result.issuer.phone, "27999990000");
  assert.equal(result.customerId, null);
});

test("promissórias: praça de pagamento editável e cliente cadastrado são mantidos", () => {
  const result = parsePromissoryForm({ ...form, paymentPlace: "  Vitória/ES ", customerId: "abc", count: "", notes: "  Entrada  " }, today);
  assert.ok(result.ok);
  assert.equal(result.paymentPlace, "Vitória/ES");
  assert.equal(result.customerId, "abc");
  assert.equal(result.installments.length, 1);
  assert.equal(result.notes, "Entrada");
});

test("promissórias: nascimento e telefone são obrigatórios", () => {
  const result = parsePromissoryForm({ ...form, birthDate: "", phone: "" }, today);
  assert.ok(!result.ok);
  assert.ok(result.fieldErrors.birthDate);
  assert.ok(result.fieldErrors.phone);
  assert.ok(!parsePromissoryForm({ ...form, phone: "9999-0000" }, today).ok);
  assert.ok(!parsePromissoryForm({ ...form, birthDate: "2027-01-01" }, today).ok);
  assert.ok(!parsePromissoryForm({ ...form, birthDate: "1985-02-30" }, today).ok);
  assert.ok(!parsePromissoryForm({ ...form, birthDate: "1800-01-01" }, today).ok);
});

test("promissórias: recusa CPF inválido, valor zerado, quantidade fora do limite e vencimento anterior à emissão", () => {
  const cases: Array<[Partial<PromissoryFormFields>, string]> = [
    [{ cpf: "111.111.111-11" }, "cpf"],
    [{ cpf: "" }, "cpf"],
    [{ name: "" }, "name"],
    [{ address: "" }, "address"],
    [{ amount: "0" }, "amount"],
    [{ amount: "abc" }, "amount"],
    [{ amount: "" }, "amount"],
    [{ count: "0" }, "count"],
    [{ count: "61" }, "count"],
    [{ count: "2,5" }, "count"],
    [{ firstDueDate: "" }, "firstDueDate"],
    [{ firstDueDate: "2026-10-28" }, "firstDueDate"],
    [{ issuedAt: "2026-13-01" }, "issuedAt"],
  ];
  for (const [patch, field] of cases) {
    const result = parsePromissoryForm({ ...form, ...patch }, today);
    assert.ok(!result.ok, JSON.stringify(patch));
    assert.ok(result.fieldErrors[field], `${field} em ${JSON.stringify(patch)}`);
  }
});

test("promissórias: limites de tamanho do PDF viram erro do formulário, não exceção", () => {
  const result = parsePromissoryForm({ ...form, address: "x".repeat(241) }, today);
  assert.ok(!result.ok);
  assert.ok(result.fieldErrors.form);
});

test("promissórias: telefone aceita DDD e 55, rejeita o resto", () => {
  assert.equal(normalizePromissoryPhone("(27) 3371-0000"), "2733710000");
  assert.equal(normalizePromissoryPhone("+55 27 99999-0000"), "27999990000");
  assert.equal(normalizePromissoryPhone("99999-0000"), null);
  assert.equal(normalizePromissoryPhone(""), null);
});

test("promissórias: status e transições", () => {
  assert.equal(parsePromissoryStatus("paga"), "paga");
  assert.equal(parsePromissoryStatus("outra"), null);
  assert.ok(canMarkPromissoryPaid("emitida") && canMarkPromissoryPaid("vinculada"));
  assert.ok(!canMarkPromissoryPaid("paga") && !canMarkPromissoryPaid("cancelada"));
  assert.ok(canCancelPromissory("emitida"));
  assert.ok(!canCancelPromissory("vinculada") && !canCancelPromissory("paga") && !canCancelPromissory("cancelada"));
});

test("promissórias: linha do banco vira entrada do PDF sem deslocar datas pelo fuso", async () => {
  const row = {
    number: 12, amount: { toString: () => "1500.00" }, dueDate: new Date("2026-11-30T00:00:00.000Z"), issuedAt: new Date("2026-10-29T00:00:00.000Z"),
    issuePlace: "Linhares/ES", paymentPlace: "Linhares/ES", issuerName: "Maria de Exemplo", issuerCpf: "529.982.247-25", issuerRg: null,
    issuerBirthDate: new Date("1985-03-12T00:00:00.000Z"), issuerPhone: "27999990000", issuerAddress: "Rua de Exemplo, 100, Centro, Linhares/ES",
  };
  const input = promissoryRowToPdfInput(row);
  assert.equal(input.amount, 1500);
  assert.equal(input.dueDate, "2026-11-30");
  assert.equal(input.issuer.birthDate, "1985-03-12");
  assert.equal(input.issuer.phone, "(27) 99999-0000");
  assert.equal(input.issuer.rg, undefined);
  const bytes = await promissoryPdf(input);
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
});

test("promissórias: datas civis e aviso da baixa", () => {
  assert.equal(dateOnly(new Date("2026-12-31T00:00:00.000Z")), "2026-12-31");
  assert.equal(formatCivilDate("2026-12-31"), "31/12/2026");
  assert.match(promissoryPaidNotice({ number: 7, issuerName: "Maria" }), /nº 7 de Maria foi baixada como paga/);
});

test("promissórias: filtro da lista por situação e busca por número, nome, CPF ou telefone", () => {
  assert.equal(parsePromissoryFilter("pagas"), "pagas");
  assert.equal(parsePromissoryFilter("qualquer"), "abertas");
  assert.deepEqual(promissoryListWhere("abertas", ""), { status: { in: ["emitida", "vinculada"] } });
  assert.deepEqual(promissoryListWhere("todas", "  "), {});
  assert.deepEqual(promissoryListWhere("pagas", "maria"), { status: { in: ["paga"] }, OR: [{ issuerName: { contains: "maria", mode: "insensitive" } }] });
  const byNumber = promissoryListWhere("todas", "42");
  assert.ok(byNumber.OR?.some((item) => "number" in item && item.number === 42));
  const byCpf = promissoryListWhere("todas", "52998224725");
  assert.ok(byCpf.OR?.some((item) => item.issuerCpf === "529.982.247-25"));
  assert.ok(byCpf.OR?.some((item) => "issuerPhone" in item));
});

test("promissórias: filtros por vencimento (vencidas, hoje, 7 dias, 30 dias)", () => {
  assert.equal(parsePromissoryDueFilter("vencidas"), "vencidas");
  assert.equal(parsePromissoryDueFilter("hoje"), "hoje");
  assert.equal(parsePromissoryDueFilter("7dias"), "7dias");
  assert.equal(parsePromissoryDueFilter("30dias"), "30dias");
  assert.equal(parsePromissoryDueFilter("invalido"), "todos");

  const overdueWhere = promissoryListWhere("abertas", "", { due: "vencidas", today: "2026-10-30" });
  assert.deepEqual(overdueWhere, {
    status: { in: ["emitida", "vinculada"] },
    dueDate: { lt: new Date("2026-10-30T00:00:00.000Z") },
  });

  const dueTodayWhere = promissoryListWhere("todas", "", { due: "hoje", today: "2026-10-30" });
  assert.deepEqual(dueTodayWhere, {
    status: { in: ["emitida", "vinculada"] },
    dueDate: new Date("2026-10-30T00:00:00.000Z"),
  });

  const next7Where = promissoryListWhere("abertas", "maria", { due: "7dias", today: "2026-10-30" });
  assert.deepEqual(next7Where, {
    status: { in: ["emitida", "vinculada"] },
    dueDate: {
      gte: new Date("2026-10-30T00:00:00.000Z"),
      lte: new Date("2026-11-06T00:00:00.000Z"),
    },
    OR: [{ issuerName: { contains: "maria", mode: "insensitive" } }],
  });

  const next30Where = promissoryListWhere("abertas", "", { due: "30dias", today: "2026-10-30" });
  assert.deepEqual(next30Where, {
    status: { in: ["emitida", "vinculada"] },
    dueDate: {
      gte: new Date("2026-10-30T00:00:00.000Z"),
      lte: new Date("2026-11-29T00:00:00.000Z"),
    },
  });
});

test("promissórias: cálculo de dias civis, atalhos de dia do mês e alerta de vencimento", () => {
  assert.equal(addDaysCivil("2026-10-30", 7), "2026-11-06");
  assert.equal(addDaysCivil("2026-12-28", 5), "2027-01-02");
  assert.equal(nextMonthDayCivil("2026-10-03", 10), "2026-10-10");
  assert.equal(nextMonthDayCivil("2026-10-10", 10), "2026-11-10");
  assert.equal(nextMonthDayCivil("2026-12-20", 5), "2027-01-05");

  assert.deepEqual(describePromissoryDue("2026-10-29", "2026-10-30", "emitida"), {
    label: "Vencida há 1 dia",
    badge: "Vencida",
    tone: "warning",
    overdue: true,
  });
  assert.deepEqual(describePromissoryDue("2026-10-25", "2026-10-30", "vinculada"), {
    label: "Vencida há 5 dias",
    badge: "Vencida",
    tone: "warning",
    overdue: true,
  });
  assert.deepEqual(describePromissoryDue("2026-10-30", "2026-10-30", "emitida"), {
    label: "Vence hoje",
    badge: "Vence hoje",
    tone: "warning",
    overdue: false,
  });
  assert.deepEqual(describePromissoryDue("2026-10-31", "2026-10-30", "emitida"), {
    label: "Vence amanhã",
    badge: "Vence amanhã",
    tone: "info",
    overdue: false,
  });
  assert.deepEqual(describePromissoryDue("2026-11-04", "2026-10-30", "emitida"), {
    label: "Vence em 5 dias",
    badge: "Vence em 5d",
    tone: "info",
    overdue: false,
  });
  assert.equal(describePromissoryDue("2026-11-15", "2026-10-30", "emitida"), null);
  assert.equal(describePromissoryDue("2026-10-01", "2026-10-30", "paga"), null);
  assert.equal(describePromissoryDue("2026-10-01", "2026-10-30", "cancelada"), null);
});

test("promissórias: PDF em lote gera uma página A4 por parcela", async () => {
  const baseRow = {
    number: 10,
    amount: { toString: () => "1200.00" },
    dueDate: new Date("2026-11-30T00:00:00.000Z"),
    issuedAt: new Date("2026-10-29T00:00:00.000Z"),
    issuePlace: "Linhares/ES",
    paymentPlace: "Linhares/ES",
    issuerName: "Maria de Exemplo",
    issuerCpf: "529.982.247-25",
    issuerRg: null,
    issuerBirthDate: new Date("1985-03-12T00:00:00.000Z"),
    issuerPhone: "27999990000",
    issuerAddress: "Rua de Exemplo, 100, Centro, Linhares/ES",
  };
  const inputs = [
    promissoryRowToPdfInput({ ...baseRow, number: 10, dueDate: new Date("2026-11-30T00:00:00.000Z") }),
    promissoryRowToPdfInput({ ...baseRow, number: 11, dueDate: new Date("2026-12-30T00:00:00.000Z") }),
    promissoryRowToPdfInput({ ...baseRow, number: 12, dueDate: new Date("2027-01-30T00:00:00.000Z") }),
  ];
  const bytes = await promissoryBatchPdf(inputs);
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  const parsedPdf = await PDFDocument.load(bytes);
  assert.equal(parsedPdf.getPageCount(), 3);
});
