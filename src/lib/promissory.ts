import { formatAdminMoney } from "./admin-money";
import { formatCpfBR, isValidCpf } from "./format";
import { integerWords, moneyInWords } from "./money-words";
import { site } from "./site";

export type PromissoryInput = {
  number?: number;
  amount: number;
  /** Datas civis no formato AAAA-MM-DD, sem horário nem conversão de fuso. */
  dueDate: string;
  issuedAt: string;
  issuePlace?: string;
  paymentPlace?: string;
  issuer: {
    name: string;
    cpf: string;
    address: string;
    rg?: string;
    birthDate?: string;
    phone?: string;
  };
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DEFAULT_PLACE = "Linhares/ES";

function dateParts(value: string) {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) throw new Error("Informe uma data válida no formato AAAA-MM-DD.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error("Informe uma data válida.");
  return { year, month, day };
}

export function promissoryDateInWords(value: string) {
  const { year, month, day } = dateParts(value);
  return `${day} (${integerWords(day)}) ${day === 1 ? "dia" : "dias"} do mês de ${MONTHS[month - 1]} do ano de ${year} (${integerWords(year)})`;
}

export function promissoryLongDate(value: string) {
  const { year, month, day } = dateParts(value);
  return `${day} de ${MONTHS[month - 1]} de ${year}`;
}

function text(value: string | undefined, label: string, max: number, required = true) {
  if (value !== undefined && typeof value !== "string") throw new Error(`${label}: informe um texto válido.`);
  const result = (value ?? "").replace(/\s+/g, " ").trim();
  if ((required && !result) || result.length > max || /[\x00-\x1F\x7F]/.test(result)) throw new Error(`${label}: ${required ? "preencha o campo e use" : "use"} até ${max} caracteres.`);
  return result;
}

/** A comparação usa a emissão, permitindo reimprimir notas históricas sem depender do relógio. */
export function validatePromissory(input: PromissoryInput) {
  if (!Number.isFinite(input.amount) || Math.round(input.amount * 100) < 1 || input.amount > 9_999_999_999.99 || Math.abs(input.amount - Math.round(input.amount * 100) / 100) > Number.EPSILON * Math.max(1, input.amount)) {
    throw new Error("Informe um valor positivo com até duas casas decimais e no máximo R$ 9.999.999.999,99.");
  }
  if (input.number !== undefined && (!Number.isSafeInteger(input.number) || input.number <= 0)) throw new Error("O número da nota deve ser um inteiro positivo.");
  dateParts(input.issuedAt);
  dateParts(input.dueDate);
  if (input.dueDate < input.issuedAt) throw new Error("O vencimento não pode ser anterior à emissão.");
  const name = text(input.issuer?.name, "Nome do emitente", 120);
  const cpf = text(input.issuer?.cpf, "CPF do emitente", 14);
  if (!/^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/.test(cpf) || !isValidCpf(cpf)) throw new Error("Informe um CPF válido para o emitente.");
  const birthDate = text(input.issuer.birthDate, "Data de nascimento", 10, false);
  if (birthDate) {
    dateParts(birthDate);
    if (birthDate > input.issuedAt) throw new Error("A data de nascimento não pode ser posterior à emissão.");
  }
  return {
    ...input,
    amount: Math.round(input.amount * 100) / 100,
    issuePlace: text(input.issuePlace ?? DEFAULT_PLACE, "Local de emissão", 100),
    paymentPlace: text(input.paymentPlace ?? DEFAULT_PLACE, "Praça de pagamento", 100),
    issuer: {
      name, cpf: formatCpfBR(cpf), birthDate,
      address: text(input.issuer.address, "Endereço do emitente", 240),
      rg: text(input.issuer.rg, "RG / órgão emissor", 60, false),
      phone: text(input.issuer.phone, "Telefone", 30, false),
    },
  };
}

export function promissoryClause(input: PromissoryInput) {
  const data = validatePromissory(input);
  const opening = data.dueDate.endsWith("-01") ? "Ao" : "Aos";
  return `${opening} ${promissoryDateInWords(data.dueDate)}, pagarei por esta única via de NOTA PROMISSÓRIA a ${site.legalName.toUpperCase()}, inscrita no CNPJ sob o nº ${site.cnpj}, ou à sua ordem, a quantia de ${formatAdminMoney(data.amount).replace(/\u00a0/g, " ")} (${moneyInWords(data.amount)}) em moeda corrente deste país.`;
}
