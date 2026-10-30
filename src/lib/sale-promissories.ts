import type { ContractPaymentItem, ContractPromissoryNote } from "./admin-commercial";
import { moneySum } from "./admin-money";

export type SalePromissoryRow = ContractPromissoryNote & { status: string; saleId: string | null; customerId: string | null; issuerCpf: string };

/** Confere os dados persistidos; nunca confia no valor ou no snapshot enviado pelo navegador. */
export function salePromissorySnapshots(payment: ContractPaymentItem, notes: SalePromissoryRow[], buyer: { id: string; cpf: string | null }, saleId?: string): ContractPromissoryNote[] {
  const ids = payment.noteIds ?? [];
  if (!ids.length || ids.length > 60 || new Set(ids).size !== ids.length || ids.length !== notes.length || notes.some((note) => !ids.includes(note.id))) throw new Error("PROMISSORY_UNAVAILABLE");
  if (notes.some((note) => saleId ? note.saleId !== saleId || !["vinculada", "paga"].includes(note.status) : note.saleId !== null || note.status !== "emitida")) throw new Error("PROMISSORY_UNAVAILABLE");
  const cpf = (buyer.cpf ?? "").replace(/\D/g, "");
  if (!cpf || notes.some((note) => note.issuerCpf.replace(/\D/g, "") !== cpf || (note.customerId && note.customerId !== buyer.id))) throw new Error("PROMISSORY_BUYER");
  if (Math.round(moneySum(notes.map((note) => note.amount)) * 100) !== Math.round(payment.amount * 100)) throw new Error("PROMISSORY_TOTAL");
  return notes.map(({ id, number, amount, dueDate }) => ({ id, number, amount, dueDate })).sort((a, b) => a.number - b.number);
}
