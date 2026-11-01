import type { Prisma } from "@prisma/client";
import { parseMoneyBR } from "./admin-money";
import { formatCpfBR, formatPhoneBR, isValidCpf } from "./format";
import { validatePromissory, type PromissoryInput } from "./promissory";

export const PROMISSORY_STATUSES = ["emitida", "vinculada", "paga", "cancelada"] as const;
export type PromissoryStatus = (typeof PROMISSORY_STATUSES)[number];

export const PROMISSORY_STATUS_LABEL: Record<PromissoryStatus, string> = {
  emitida: "Emitida",
  vinculada: "Vinculada à venda",
  paga: "Paga",
  cancelada: "Cancelada",
};

export const PROMISSORY_MAX_INSTALLMENTS = 60;
export const PROMISSORY_DEFAULT_PLACE = "Linhares/ES";

export function parsePromissoryStatus(value: unknown): PromissoryStatus | null {
  return PROMISSORY_STATUSES.find((status) => status === value) ?? null;
}

/** Baixa vale para nota ainda em aberto (emitida ou já vinculada a uma venda). */
export function canMarkPromissoryPaid(status: string) {
  return status === "emitida" || status === "vinculada";
}

/** Só nota sem venda pode ser cancelada; a vinculada precisa sair da venda antes (PR-3). */
export function canCancelPromissory(status: string) {
  return status === "emitida";
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Soma meses a uma data AAAA-MM-DD mantendo o dia; em mês curto usa o último dia (31/01 + 1 = 28/02). */
export function addMonthsClamped(value: string, months: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Informe uma data válida no formato AAAA-MM-DD.");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const index = year * 12 + (month - 1) + months;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  const nextDay = Math.min(day, daysInMonth(nextYear, nextMonth));
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
}

/** Vencimentos mensais a partir do primeiro. Cada mês parte da data original, sem acumular o ajuste do dia. */
export function promissoryInstallmentDates(firstDueDate: string, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > PROMISSORY_MAX_INSTALLMENTS) {
    throw new Error(`Informe de 1 a ${PROMISSORY_MAX_INSTALLMENTS} notas.`);
  }
  return Array.from({ length: count }, (_, index) => addMonthsClamped(firstDueDate, index));
}

/** Soma dias a uma data civil AAAA-MM-DD em UTC, sem deslocamento de fuso. */
export function addDaysCivil(value: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Informe uma data válida no formato AAAA-MM-DD.");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

/** Próxima data civil com o dia informado (ex.: 5, 10, 15) após a data base. */
export function nextMonthDayCivil(baseDate: string, targetDay: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseDate);
  if (!match || !Number.isInteger(targetDay) || targetDay < 1 || targetDay > 31) {
    throw new Error("Informe uma data base e um dia do mês válidos.");
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const candidateThisMonth = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(Math.min(targetDay, daysInMonth(year, month))).padStart(2, "0")}`;
  if (day < targetDay && candidateThisMonth > baseDate) return candidateThisMonth;
  const nextIndex = year * 12 + month;
  const nextYear = Math.floor(nextIndex / 12);
  const nextMonth = (nextIndex % 12) + 1;
  const clampedDay = Math.min(targetDay, daysInMonth(nextYear, nextMonth));
  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/** Diferença em dias civis (to - from) entre duas datas AAAA-MM-DD. */
export function diffCivilDays(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export type PromissoryDueAlert = {
  label: string;
  badge: string;
  tone: "warning" | "info";
  overdue: boolean;
};

/** Descreve a urgência do vencimento para notas em aberto (vencida, vence hoje, vence em até 7 dias). */
export function describePromissoryDue(dueDate: string, today: string, status: string): PromissoryDueAlert | null {
  if (!canMarkPromissoryPaid(status) || !validDate(dueDate) || !validDate(today)) return null;
  const diff = diffCivilDays(today, dueDate);
  if (diff < 0) {
    const days = Math.abs(diff);
    return {
      label: days === 1 ? "Vencida há 1 dia" : `Vencida há ${days} dias`,
      badge: "Vencida",
      tone: "warning",
      overdue: true,
    };
  }
  if (diff === 0) return { label: "Vence hoje", badge: "Vence hoje", tone: "warning", overdue: false };
  if (diff === 1) return { label: "Vence amanhã", badge: "Vence amanhã", tone: "info", overdue: false };
  if (diff <= 7) return { label: `Vence em ${diff} dias`, badge: `Vence em ${diff}d`, tone: "info", overdue: false };
  return null;
}

export type PromissoryFormFields = {
  customerId: string;
  name: string;
  cpf: string;
  rg: string;
  birthDate: string;
  phone: string;
  address: string;
  amount: string;
  count: string;
  firstDueDate: string;
  issuedAt: string;
  issuePlace: string;
  paymentPlace: string;
  notes: string;
};

export type PromissoryFormResult =
  | { ok: false; fieldErrors: Record<string, string> }
  | {
      ok: true;
      customerId: string | null;
      notes: string | null;
      issuer: { name: string; cpf: string; rg: string; birthDate: string; phone: string; address: string };
      issuedAt: string;
      issuePlace: string;
      paymentPlace: string;
      installments: Array<{ installmentNo: number; installmentCount: number; amount: number; dueDate: string }>;
    };

const DATE = /^[1-9]\d{3}-\d{2}-\d{2}$/;

function validDate(value: string) {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Telefone com DDD (10 ou 11 dígitos), aceitando o 55 na frente. Devolve só dígitos ou null. */
export function normalizePromissoryPhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

/**
 * Valida o formulário da aba (emitente, valor, quantidade, datas) e monta as parcelas.
 * Nascimento e telefone são obrigatórios; praça e local de emissão têm Linhares/ES como padrão.
 */
export function parsePromissoryForm(fields: Partial<PromissoryFormFields>, today: string): PromissoryFormResult {
  const errors: Record<string, string> = {};
  const name = clean(fields.name);
  const cpf = clean(fields.cpf);
  const rg = clean(fields.rg);
  const address = clean(fields.address);
  const birthDate = clean(fields.birthDate);
  const issuedAt = clean(fields.issuedAt) || today;
  const firstDueDate = clean(fields.firstDueDate);
  const issuePlace = clean(fields.issuePlace) || PROMISSORY_DEFAULT_PLACE;
  const paymentPlace = clean(fields.paymentPlace) || PROMISSORY_DEFAULT_PLACE;
  const notes = clean(fields.notes);
  const count = Number(clean(fields.count) || "1");
  const amount = parseMoneyBR(fields.amount);
  const rawPhone = clean(fields.phone);
  const phone = normalizePromissoryPhone(rawPhone);
  const rawAmount = clean(fields.amount);

  if (name.length < 2) errors.name = "Informe o nome completo do emitente.";
  if (!cpf) errors.cpf = "Informe o CPF do emitente (11 dígitos).";
  else if (!isValidCpf(cpf)) errors.cpf = "CPF inválido. Confira os 11 dígitos.";
  if (!address) errors.address = "Informe o endereço completo do emitente (rua, número, bairro e cidade/UF).";
  if (!birthDate) errors.birthDate = "Informe a data de nascimento.";
  else if (!validDate(birthDate) || birthDate < "1900-01-01") errors.birthDate = "Data de nascimento inválida.";
  else if (birthDate > today) errors.birthDate = "A data de nascimento não pode ser futura.";
  if (!rawPhone) errors.phone = "Informe o telefone com DDD.";
  else if (!phone) errors.phone = "Informe o telefone com DDD (10 ou 11 dígitos, ex.: (27) 99999-0000).";
  if (!rawAmount) errors.amount = "Informe o valor de cada nota.";
  else if (amount === null || amount <= 0) errors.amount = "Informe um valor maior que zero.";
  if (!Number.isInteger(count) || count < 1 || count > PROMISSORY_MAX_INSTALLMENTS) errors.count = `Informe de 1 a ${PROMISSORY_MAX_INSTALLMENTS} notas.`;
  if (!validDate(issuedAt)) errors.issuedAt = "Data de emissão inválida.";
  if (!validDate(firstDueDate)) errors.firstDueDate = "Informe o primeiro vencimento.";
  else if (validDate(issuedAt) && firstDueDate < issuedAt) errors.firstDueDate = "O vencimento não pode ser anterior à emissão.";
  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };

  const dates = promissoryInstallmentDates(firstDueDate, count);
  const installments = dates.map((dueDate, index) => ({ installmentNo: index + 1, installmentCount: count, amount: amount as number, dueDate }));
  const issuer = { name, cpf, rg, birthDate, phone: phone as string, address };

  // Passa pelas regras do PDF (limites de tamanho, CPF, datas) para a nota nunca ser gravada se não puder ser impressa.
  try {
    const checked = validatePromissory({ amount: amount as number, dueDate: dates[0], issuedAt, issuePlace, paymentPlace, issuer });
    return { ok: true, customerId: clean(fields.customerId) || null, notes: notes || null, issuer: { ...issuer, cpf: checked.issuer.cpf }, issuedAt, issuePlace: checked.issuePlace, paymentPlace: checked.paymentPlace, installments };
  } catch (error) {
    return { ok: false, fieldErrors: { form: error instanceof Error ? error.message : "Dados inválidos." } };
  }
}

type NoteRow = {
  status?: string;
  paidAt?: Date | null;
  number: number;
  amount: { toString(): string } | number;
  dueDate: Date;
  issuedAt: Date;
  issuePlace: string;
  paymentPlace: string;
  issuerName: string;
  issuerCpf: string;
  issuerRg: string | null;
  issuerBirthDate: Date;
  issuerPhone: string;
  issuerAddress: string;
};

/** Colunas `DATE` chegam como meia-noite UTC: a data civil é a parte AAAA-MM-DD do ISO. */
export function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

/** Converte a linha do banco no formato do PDF (PR-1). */
export function promissoryRowToPdfInput(row: NoteRow): PromissoryInput {
  return {
    number: row.number,
    status: row.status,
    paidAt: row.paidAt?.toISOString() ?? null,
    amount: Number(row.amount.toString()),
    dueDate: dateOnly(row.dueDate),
    issuedAt: dateOnly(row.issuedAt),
    issuePlace: row.issuePlace,
    paymentPlace: row.paymentPlace,
    issuer: {
      name: row.issuerName,
      cpf: row.issuerCpf,
      address: row.issuerAddress,
      rg: row.issuerRg ?? undefined,
      birthDate: dateOnly(row.issuerBirthDate),
      phone: formatPhoneBR(row.issuerPhone),
    },
  };
}

/** Texto do aviso da agenda quando a nota é baixada. */
export function promissoryPaidNotice(note: { number: number; issuerName: string }) {
  return `Nota promissória nº ${note.number} de ${note.issuerName} foi baixada como paga. Confira o recebimento e devolva a via original quitada ao cliente.`;
}

/** AAAA-MM-DD para o formato dd/mm/aaaa, sem passar por Date (evita deslocar o dia pelo fuso). */
export function formatCivilDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export const PROMISSORY_FILTERS = [
  { value: "abertas", label: "Em aberto" },
  { value: "pagas", label: "Pagas" },
  { value: "canceladas", label: "Canceladas" },
  { value: "todas", label: "Todas" },
] as const;
export type PromissoryFilter = (typeof PROMISSORY_FILTERS)[number]["value"];

export function parsePromissoryFilter(value: unknown): PromissoryFilter {
  return PROMISSORY_FILTERS.find((item) => item.value === value)?.value ?? "abertas";
}

export const PROMISSORY_DUE_FILTERS = [
  { value: "todos", label: "Todos os vencimentos" },
  { value: "vencidas", label: "Vencidas" },
  { value: "hoje", label: "Vence hoje" },
  { value: "7dias", label: "Próximos 7 dias" },
  { value: "30dias", label: "Próximos 30 dias" },
] as const;
export type PromissoryDueFilter = (typeof PROMISSORY_DUE_FILTERS)[number]["value"];

export function parsePromissoryDueFilter(value: unknown): PromissoryDueFilter {
  return PROMISSORY_DUE_FILTERS.find((item) => item.value === value)?.value ?? "todos";
}

const FILTER_STATUS: Record<PromissoryFilter, PromissoryStatus[] | null> = {
  abertas: ["emitida", "vinculada"],
  pagas: ["paga"],
  canceladas: ["cancelada"],
  todas: null,
};

function civilUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dueFilterClause(due: PromissoryDueFilter | undefined, today: string | undefined): Prisma.DateTimeFilter | Date | undefined {
  if (!due || due === "todos" || !today || !validDate(today)) return undefined;
  const todayUtc = civilUtcDate(today);
  if (due === "vencidas") return { lt: todayUtc };
  if (due === "hoje") return todayUtc;
  if (due === "7dias") return { gte: todayUtc, lte: civilUtcDate(addDaysCivil(today, 7)) };
  if (due === "30dias") return { gte: todayUtc, lte: civilUtcDate(addDaysCivil(today, 30)) };
  return undefined;
}

/** Filtro da lista: status da aba + vencimento + busca por número, nome, CPF ou telefone do emitente. */
export function promissoryListWhere(
  filter: PromissoryFilter,
  query: string,
  options?: { due?: PromissoryDueFilter; today?: string },
): Prisma.PromissoryNoteWhereInput {
  const dueClause = dueFilterClause(options?.due, options?.today);
  const statuses = FILTER_STATUS[filter] ?? (dueClause ? ["emitida", "vinculada"] : null);
  const term = query.trim().slice(0, 80);
  const digits = term.replace(/\D/g, "");
  const number = /^\d{1,9}$/.test(term) ? Number(term) : null;
  const or: Prisma.PromissoryNoteWhereInput[] = [];
  if (term) or.push({ issuerName: { contains: term, mode: "insensitive" } });
  if (number !== null) or.push({ number });
  if (digits.length >= 3) or.push({ issuerCpf: { contains: term } });
  if (digits.length === 11) or.push({ issuerCpf: formatCpfBR(digits) });
  if (digits.length >= 4) or.push({ issuerPhone: { contains: digits } });
  return {
    ...(statuses ? { status: { in: statuses } } : {}),
    ...(dueClause ? { dueDate: dueClause } : {}),
    ...(or.length ? { OR: or } : {}),
  };
}
