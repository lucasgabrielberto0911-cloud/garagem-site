"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/admin-audit";
import { localDateInput } from "@/lib/admin-date";
import { prisma } from "@/lib/prisma";
import { parsePromissoryForm, type PromissoryFormFields } from "@/lib/promissory-notes";

export type PromissoryActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  noteIds?: string[];
};

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}

function civilDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function refresh() {
  revalidatePath("/admin/promissorias");
  revalidatePath("/admin/agenda");
}

const PROMISSORY_LOCK_KEY = 20261029;

const FIELDS: Array<keyof PromissoryFormFields> = ["customerId", "name", "cpf", "rg", "birthDate", "phone", "address", "amount", "count", "firstDueDate", "issuedAt", "issuePlace", "paymentPlace", "notes"];

/** Emite uma ou várias notas mensais de uma vez; os números saem da sequência do banco, na ordem das parcelas. */
export async function createPromissoryNotes(formData: FormData): Promise<PromissoryActionState> {
  const session = await requireAdmin();
  const fields = Object.fromEntries(FIELDS.map((key) => [key, String(formData.get(key) ?? "")])) as Partial<PromissoryFormFields>;
  const parsed = parsePromissoryForm(fields, localDateInput());
  if (!parsed.ok) return { ok: false, message: parsed.fieldErrors.form ?? "Corrija os campos destacados.", fieldErrors: parsed.fieldErrors };

  try {
    if (parsed.customerId && !(await prisma.customer.findUnique({ where: { id: parsed.customerId }, select: { id: true } }))) {
      return { ok: false, message: "Cliente não encontrado. Busque de novo ou preencha os dados à mão.", fieldErrors: { customerId: "Cliente não encontrado." } };
    }
    const numbers = await prisma.$transaction(async (tx) => {
      // Serializa as emissões: os números do lote saem seguidos mesmo com duas emissões ao mesmo tempo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PROMISSORY_LOCK_KEY})`;
      const created: { id: string; number: number }[] = [];
      for (const installment of parsed.installments) {
        const note = await tx.promissoryNote.create({
          data: {
            customerId: parsed.customerId,
            issuerName: parsed.issuer.name,
            issuerCpf: parsed.issuer.cpf,
            issuerRg: parsed.issuer.rg || null,
            issuerBirthDate: civilDate(parsed.issuer.birthDate),
            issuerPhone: parsed.issuer.phone,
            issuerAddress: parsed.issuer.address,
            amount: installment.amount.toFixed(2),
            dueDate: civilDate(installment.dueDate),
            issuedAt: civilDate(parsed.issuedAt),
            issuePlace: parsed.issuePlace,
            paymentPlace: parsed.paymentPlace,
            installmentNo: installment.installmentNo,
            installmentCount: installment.installmentCount,
            notes: parsed.notes,
          },
          select: { id: true, number: true },
        });
        created.push(note);
        await recordAdminAudit(tx, session.adminId, note.id, "promissory.create", { number: note.number, installment: `${installment.installmentNo}/${installment.installmentCount}`, amount: installment.amount, dueDate: installment.dueDate });
      }
      return created;
    });
    refresh();
    return { ok: true, noteIds: numbers.map((note) => note.id), message: numbers.length === 1 ? `Nota nº ${numbers[0].number} emitida.` : `${numbers.length} notas emitidas (nº ${numbers.map((note) => note.number).join(", ")}).` };
  } catch (error) {
    console.error("[admin/promissorias] falha ao emitir:", error);
    return { ok: false, message: "Não foi possível emitir as notas. Nada foi salvo." };
  }
}

/** Baixa: só nota em aberto; deixa o aviso pendente na agenda até alguém dar ciência. */
export async function markPromissoryPaid(id: string): Promise<PromissoryActionState> {
  const session = await requireAdmin();
  try {
    const done = await prisma.$transaction(async (tx) => {
      const result = await tx.promissoryNote.updateMany({
        where: { id, status: { in: ["emitida", "vinculada"] } },
        data: { status: "paga", paidAt: new Date(), paidNoticeDoneAt: null },
      });
      if (result.count) await recordAdminAudit(tx, session.adminId, id, "promissory.paid", {});
      return result.count;
    });
    if (!done) return { ok: false, message: "Só nota emitida ou vinculada pode ser marcada como paga." };
    refresh();
    return { ok: true, message: "Nota marcada como paga. O aviso foi para a agenda." };
  } catch (error) {
    console.error("[admin/promissorias] falha ao baixar:", error);
    return { ok: false, message: "Não foi possível marcar a nota como paga." };
  }
}

export async function cancelPromissory(id: string): Promise<PromissoryActionState> {
  const session = await requireAdmin();
  try {
    const done = await prisma.$transaction(async (tx) => {
      const result = await tx.promissoryNote.updateMany({ where: { id, status: "emitida" }, data: { status: "cancelada" } });
      if (result.count) await recordAdminAudit(tx, session.adminId, id, "promissory.cancel", {});
      return result.count;
    });
    if (!done) return { ok: false, message: "Só nota emitida e sem venda pode ser cancelada." };
    refresh();
    return { ok: true, message: "Nota cancelada." };
  } catch (error) {
    console.error("[admin/promissorias] falha ao cancelar:", error);
    return { ok: false, message: "Não foi possível cancelar a nota." };
  }
}

/** Dá ciência do aviso da baixa (some da agenda). */
export async function dismissPromissoryNotice(id: string): Promise<void> {
  await requireAdmin();
  await prisma.promissoryNote.updateMany({ where: { id, status: "paga", paidNoticeDoneAt: null }, data: { paidNoticeDoneAt: new Date() } });
  refresh();
}
