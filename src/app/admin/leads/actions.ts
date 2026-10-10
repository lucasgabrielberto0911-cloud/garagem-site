"use server";

import { isLeadOrigin } from "@/lib/lead-origin";
import { businessDay } from "@/lib/admin-date";
import { PURCHASE_STATUSES, PURCHASE_STATUS_LABEL, funnelActivity } from "@/lib/lead-funnel";
import { revalidatePath, revalidateTag } from "next/cache";
import { expireAdminData } from "@/lib/admin-revalidate";
import { getSession } from "@/lib/auth";
import { ADMIN_NEW_LEADS_TAG } from "@/lib/admin-cache";
import { lockCustomerIdentity } from "@/lib/admin-customer-lock";
import { WANTED_LEAD_SOURCE, isLeadStatus } from "@/lib/leads";
import { emailFromLeadNotes } from "@/lib/wanted-lead";
import { prisma } from "@/lib/prisma";

export type LeadActionState = { ok: boolean; message: string };

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Sessão expirada.");
  return session;
}

export async function updateLeadStatus(
  id: string,
  status: string,
): Promise<LeadActionState> {
  try {
    const session = await requireAdmin();

    if (!isLeadStatus(status)) {
      return { ok: false, message: "Status inválido." };
    }

    await prisma.$transaction(async (tx) => {
      const lead = await tx.leadVenda.findUniqueOrThrow({ where: { id } });
      if (lead.status === status) return;
      await tx.leadVenda.update({ where: { id }, data: {
        status, ...(status === "fechado" || status === "perdido" ? { nextAction: null, nextActionAt: null } : {}),
      } });
      await tx.leadActivity.create({ data: {
        leadId: id, adminId: session.adminId, note: `${funnelActivity(status)} Situação atualizada para ${status}.`,
      } });
    });
    revalidateTag(ADMIN_NEW_LEADS_TAG, "max");
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    expireAdminData();
    return { ok: true, message: "Status atualizado." };
  } catch (error) {
    console.error("[admin/leads] falha ao atualizar status:", error);
    return { ok: false, message: "Não foi possível atualizar o status." };
  }
}

/**
 * Transforma um lead em cliente do cadastro, reaproveitando nome e telefone.
 * Se já existir alguém com o mesmo telefone, apenas avisa em vez de duplicar.
 */
export async function convertLeadToCustomer(
  id: string,
): Promise<LeadActionState> {
  try {
    await requireAdmin();

    const lead = await prisma.leadVenda.findUnique({ where: { id } });
    if (!lead) return { ok: false, message: "Lead não encontrado." };

    const phone = lead.phone.replace(/\D/g, "");
    if (phone.length < 10)
      return {
        ok: false,
        message: "Confira o telefone do contato antes de criar o cliente.",
      };
    await prisma.$transaction(async (tx) => {
      await lockCustomerIdentity(tx, phone);
      const existing = await tx.customer.findFirst({ where: { phone } });
      if (existing) throw new Error("DUPLICATE_CUSTOMER");
      const wanted = lead.source === WANTED_LEAD_SOURCE;
      await tx.customer.create({
        data: {
          name: lead.name,
          phone,
          email: emailFromLeadNotes(lead.notes),
          notes: wanted
            ? `Pedido de modelo: ${lead.vehicleInfo}${lead.notes ? ` — ${lead.notes}` : ""}`
            : `Lead de ${lead.source?.startsWith("whatsapp:") ? "compra" : "venda/troca"}: ${lead.vehicleInfo}${lead.plate ? ` · placa ${lead.plate}` : ""}${lead.notes ? ` — ${lead.notes}` : ""}`,
        },
      });
      if (!lead.source?.startsWith("whatsapp:")) await tx.leadVenda.update({
        where: { id }, data: { status: "contatado" },
      });
    });
    revalidateTag(ADMIN_NEW_LEADS_TAG, "max");
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    expireAdminData();
    revalidatePath("/admin/clientes");
    return { ok: true, message: "Cliente criado a partir do lead." };
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_CUSTOMER")
      return {
        ok: false,
        message:
          "Já existe cliente com esse telefone. Confira o cadastro existente, sem duplicar.",
      };
    console.error("[admin/leads] falha ao converter lead:", error);
    return { ok: false, message: "Não foi possível criar o cliente." };
  }
}

export async function deleteLead(id: string): Promise<LeadActionState> {
  try {
    await requireAdmin();
    await prisma.leadVenda.delete({ where: { id } });
    revalidateTag(ADMIN_NEW_LEADS_TAG, "max");
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    expireAdminData();
    return { ok: true, message: "Lead removido." };
  } catch (error) {
    console.error("[admin/leads] falha ao remover lead:", error);
    return { ok: false, message: "Não foi possível remover o lead." };
  }
}

/** Cadastro rápido de uma conversa de compra; etapas ficam no histórico existente. */
export async function savePurchaseLead(form: FormData): Promise<LeadActionState> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, message: "Sessão expirada." };
    const value = (key: string) => String(form.get(key) || "").trim();
    const id = value("id");
    const name = value("name");
    const phone = value("phone").replace(/\D/g, "");
    const origin = value("origin");
    const status = value("status");
    const interestVehicleId = value("vehicle") || null;
    const nextAction = value("nextAction");
    const nextActionAt = value("date") ? businessDay(value("date")) : null;
    if (!name || name.length > 120 || !/^\d{10,13}$/.test(phone) || !isLeadOrigin(origin) ||
      !(PURCHASE_STATUSES as readonly string[]).includes(status) || nextAction.length > 300 ||
      (nextActionAt && (!nextAction || Number.isNaN(nextActionAt.getTime())))) {
      return { ok: false, message: "Confira nome, telefone, origem e próxima ação/data." };
    }
    await prisma.$transaction(async (tx) => {
      const existing = id ? await tx.leadVenda.findUnique({ where: { id } }) : null;
      if (id && !existing?.source?.startsWith("whatsapp:")) throw new Error("Conversa não encontrada.");
      const vehicle = interestVehicleId ? await tx.vehicle.findUnique({
        where: { id: interestVehicleId }, select: { brand: true, model: true, version: true, yearModel: true },
      }) : null;
      if (interestVehicleId && !vehicle) throw new Error("Veículo não encontrado.");
      const terminal = status === "fechado" || status === "perdido";
      const data = {
        name, phone, source: `whatsapp:${origin}`, status, interestVehicleId,
        vehicleInfo: vehicle ? [vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel].filter(Boolean).join(" ") : "Sem veículo definido",
        nextAction: terminal ? null : nextAction || null,
        nextActionAt: terminal ? null : nextActionAt,
      };
      const lead = id ? await tx.leadVenda.update({ where: { id }, data }) : await tx.leadVenda.create({ data });
      if (!existing || existing.status !== status) await tx.leadActivity.create({
        data: { leadId: lead.id, adminId: session.adminId, note: `${funnelActivity(status)} ${PURCHASE_STATUS_LABEL[status as keyof typeof PURCHASE_STATUS_LABEL]}` },
      });
    });
    revalidateTag(ADMIN_NEW_LEADS_TAG, "max");
    revalidatePath("/admin/leads");
    revalidatePath("/admin/agenda");
    expireAdminData();
    return { ok: true, message: id ? "Conversa atualizada." : "Conversa registrada." };
  } catch (error) {
    console.error("[admin/leads] falha ao registrar conversa:", error);
    return { ok: false, message: "Não foi possível salvar a conversa. Confira os dados e tente novamente." };
  }
}
