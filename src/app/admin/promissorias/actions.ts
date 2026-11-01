"use server";

import { createHash } from "node:crypto";
import { validatePromissoryPages } from "@/lib/promissory-pdf";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/admin-audit";
import { localDateInput } from "@/lib/admin-date";
import { prisma } from "@/lib/prisma";
import { PROMISSORY_COMPAT_OMIT, parsePromissoryForm, type PromissoryFormFields } from "@/lib/promissory-notes";
import { isMissingColumnError } from "@/lib/prisma-errors";

export type CreatedPromissorySummary = {
  id: string;
  number: number;
  installmentNo: number;
  installmentCount: number;
  amount: number;
  dueDate: string;
};

export type PromissoryActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  noteIds?: string[];
  createdNotes?: CreatedPromissorySummary[];
  issuerName?: string;
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

  const requestId = String(formData.get("requestId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, message: "Reabra o formulário para identificar esta emissão." };
  const issuanceKey = `${session.adminId}:${requestId}`;
  const issuanceHash = createHash("sha256").update(JSON.stringify(parsed)).digest("hex");
  try {
    try {
      await validatePromissoryPages(parsed.installments.map((item) => ({ ...item, number: 2147483647, issuer: parsed.issuer, issuedAt: parsed.issuedAt, issuePlace: parsed.issuePlace, paymentPlace: parsed.paymentPlace })));
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : "Não foi possível validar o A4. Tente novamente.", fieldErrors: { form: "Confira os dados e reduza os textos para caberem em uma página A4." } };
    }
    if (parsed.customerId && !(await prisma.customer.findUnique({ where: { id: parsed.customerId }, select: { id: true } }))) {
      return { ok: false, message: "Cliente não encontrado. Busque de novo ou preencha os dados à mão.", fieldErrors: { customerId: "Cliente não encontrado." } };
    }
    const createdNotes = await prisma.$transaction(async (tx) => {
      // Serializa as emissões: os números do lote saem seguidos mesmo com duas emissões ao mesmo tempo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PROMISSORY_LOCK_KEY})`;
      const existing = await tx.promissoryNote.findMany({ where: { issuanceKey }, orderBy: { installmentNo: "asc" } });
      if (existing.length) {
        if (existing.length !== parsed.installments.length || existing.some((note) => note.issuanceHash !== issuanceHash)) throw new Error("ISSUANCE_CONFLICT");
        return existing.map((note) => ({ id: note.id, number: note.number, installmentNo: note.installmentNo, installmentCount: note.installmentCount, amount: Number(note.amount), dueDate: note.dueDate.toISOString().slice(0, 10) }));
      }
      const created: CreatedPromissorySummary[] = [];
      for (const installment of parsed.installments) {
        const note = await tx.promissoryNote.create({
          data: {
            issuanceKey, issuanceHash,
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
        created.push({
          id: note.id,
          number: note.number,
          installmentNo: installment.installmentNo,
          installmentCount: installment.installmentCount,
          amount: installment.amount,
          dueDate: installment.dueDate,
        });
        await recordAdminAudit(tx, session.adminId, note.id, "promissory.create", { number: note.number, installment: `${installment.installmentNo}/${installment.installmentCount}`, amount: installment.amount, dueDate: installment.dueDate });
      }
      return created;
    });
    const numbers = createdNotes.map((item) => item.number);
    refresh();
    return {
      ok: true,
      noteIds: createdNotes.map((item) => item.id),
      message: numbers.length === 1 ? `Nota nº ${numbers[0]} emitida.` : `${numbers.length} notas emitidas (nº ${numbers.join(", ")}).`,
      createdNotes,
      issuerName: parsed.issuer.name,
    };
  } catch (error) {
    if (isMissingColumnError(error, "issuanceKey") || isMissingColumnError(error, "issuanceHash")) return { ok: false, message: "A emissão aguarda uma atualização do sistema. Nada foi salvo; tente novamente após a atualização." };
    if (error instanceof Error && error.message === "ISSUANCE_CONFLICT") return { ok: false, message: "Esta solicitação já foi emitida com outros dados. Confira o lote antes de iniciar outra emissão." };
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

/** Retifica a baixa sem apagar o evento original da auditoria. */
export async function reversePromissoryPayment(id: string, reason: string): Promise<PromissoryActionState> {
  const session = await requireAdmin();
  const motive = reason.trim();
  if (motive.length < 10 || motive.length > 500) return { ok: false, message: "Informe um motivo entre 10 e 500 caracteres." };
  try {
    const done = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PromissoryNote" WHERE "id" = ${id} FOR UPDATE`;
      const note = await tx.promissoryNote.findUnique({ where: { id }, omit: PROMISSORY_COMPAT_OMIT });
      if (!note || note.status !== "paga") return false;
      const updated = await tx.promissoryNote.updateMany({ where: { id, status: "paga" }, data: { status: note.saleId ? "vinculada" : "emitida", paidAt: null, paidNoticeDoneAt: null } });
      if (!updated.count) return false;
      await recordAdminAudit(tx, session.adminId, id, "promissory.payment.reversed", { reason: motive, originalPaidAt: note.paidAt?.toISOString() ?? null });
      return true;
    });
    if (!done) return { ok: false, message: "Só uma nota paga pode ter a baixa retificada." };
    refresh();
    return { ok: true, message: "Baixa retificada; nota novamente em aberto. Histórico preservado." };
  } catch {
    return { ok: false, message: "Não foi possível retificar a baixa." };
  }
}
