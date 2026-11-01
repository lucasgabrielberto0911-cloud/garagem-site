"use server";

import { normalizeAdminPhone } from "@/lib/admin-phone";
import { isLeadOrigin } from "@/lib/lead-origin";
import { adminActionDate, businessDay } from "@/lib/admin-date";
import { PURCHASE_STATUSES, PURCHASE_STATUS_LABEL, funnelActivity } from "@/lib/lead-funnel";
import { revalidatePath, revalidateTag } from "next/cache";
import { expireAdminData } from "@/lib/admin-revalidate";
import { getSession } from "@/lib/auth";
import { recordAdminAudit } from "@/lib/admin-audit";
import { ADMIN_NEW_LEADS_TAG } from "@/lib/admin-cache";
import { lockCustomerIdentity } from "@/lib/admin-customer-lock";
import {
  LEAD_STATUS_LABEL,
  WANTED_LEAD_SOURCE,
  isLeadLossReason,
  isLeadStatus,
  lossReasonActivity,
} from "@/lib/leads";
import { isMissingColumnError } from "@/lib/prisma-errors";
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
  lostReason?: string | null,
  lossDetail?: string | null,
): Promise<LeadActionState> {
  try {
    const session = await requireAdmin();

    if (!isLeadStatus(status)) {
      return { ok: false, message: "Status inválido." };
    }

    const validReason =
      lostReason && isLeadLossReason(lostReason) ? lostReason : null;

    const cleanLossDetail = (lossDetail ?? "").trim().slice(0, 500);

    // Erro de coluna dentro da transação aborta o Postgres: refaz a transação inteira sem lostReason.
    const run = (withLostReason: boolean) => prisma.$transaction(async (tx) => {
      const lead = await tx.leadVenda.findUniqueOrThrow({
        where: { id },
        select: { id: true, status: true },
      });
      const statusChanged = lead.status !== status;
      const baseData = {
        status,
        ...(status === "fechado" || status === "perdido"
          ? { nextAction: null, nextActionAt: null }
          : {}),
      };
      await tx.leadVenda.update({
        where: { id },
        data: {
          ...baseData,
          ...(!withLostReason
            ? {}
            : status === "fechado"
              ? { lostReason: null }
              : validReason
                ? { lostReason: validReason }
                : {}),
        },
      });
      if (statusChanged) {
        const label = LEAD_STATUS_LABEL[status] ?? status;
        await tx.leadActivity.create({
          data: {
            leadId: id,
            adminId: session.adminId,
            note: `${funnelActivity(status)} Situação atualizada para ${label}.`,
          },
        });
      }
      if (validReason) {
        await tx.leadActivity.create({
          data: {
            leadId: id,
            adminId: session.adminId,
            note: lossReasonActivity(validReason, cleanLossDetail),
          },
        });
      }
    });
    try {
      await run(true);
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      await run(false);
    }
    revalidateTag(ADMIN_NEW_LEADS_TAG, { expire: 0 });
    revalidatePath("/admin/leads");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    expireAdminData();
    return { ok: true, message: "Status atualizado." };
  } catch (error) {
    console.error("[admin/leads] falha ao atualizar status:", error);
    return { ok: false, message: "Não foi possível atualizar o status." };
  }
}

export async function saveLeadLossReason(
  id: string,
  reason: string,
  detail?: string | null,
): Promise<LeadActionState> {
  try {
    const session = await requireAdmin();
    if (!isLeadLossReason(reason)) {
      return { ok: false, message: "Selecione um motivo válido." };
    }
    const cleanDetail = (detail ?? "").trim();
    if (cleanDetail.length > 500) {
      return { ok: false, message: "A observação pode ter no máximo 500 caracteres." };
    }

    try {
      await prisma.leadVenda.update({
        where: { id },
        data: { lostReason: reason },
      });
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
    }
    await prisma.$transaction(async (tx) => {
      await tx.leadActivity.create({
        data: {
          leadId: id,
          adminId: session.adminId,
          note: lossReasonActivity(reason, cleanDetail),
        },
      });
    });

    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    expireAdminData();
    return { ok: true, message: "Motivo registrado no histórico do lead." };
  } catch (error) {
    console.error("[admin/leads] falha ao salvar motivo de perda:", error);
    return { ok: false, message: "Não foi possível registrar o motivo." };
  }
}

/**
 * Registra toque no botão de WhatsApp e, se o lead ainda estiver "novo",
 * muda automaticamente para "contatado".
 */
export async function recordLeadWhatsAppClick(
  id: string,
): Promise<LeadActionState> {
  try {
    const session = await requireAdmin();

    await prisma.$transaction(async (tx) => {
      const lead = await tx.leadVenda.findUnique({
        where: { id },
        select: { id: true, status: true },
      });
      if (!lead) throw new Error("NOT_FOUND");
      const wasNew = lead.status === "novo";
      if (wasNew) {
        await tx.leadVenda.update({
          where: { id },
          data: { status: "contatado" },
        });
      }
      await tx.leadActivity.create({
        data: {
          leadId: id,
          adminId: session.adminId,
          note: wasNew
            ? `${funnelActivity("contatado")} Abriu WhatsApp`
            : "Abriu WhatsApp",
        },
      });
    });

    revalidateTag(ADMIN_NEW_LEADS_TAG, { expire: 0 });
    revalidatePath("/admin/leads");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    expireAdminData();
    return { ok: true, message: "Contato via WhatsApp registrado." };
  } catch (error) {
    console.error("[admin/leads] falha ao registrar WhatsApp:", error);
    return { ok: false, message: "Não foi possível registrar o contato." };
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
    const session = await requireAdmin();

    const lead = await prisma.leadVenda.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        notes: true,
        source: true,
        vehicleInfo: true,
        plate: true,
      },
    });
    if (!lead) return { ok: false, message: "Lead não encontrado." };

    const phone = normalizeAdminPhone(lead.phone);
    if (!phone)
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
      if (!lead.source?.startsWith("whatsapp:"))
        await tx.leadVenda.update({
          where: { id },
          data: { status: "contatado" },
        });
      await tx.leadActivity.create({
        data: {
          leadId: id,
          adminId: session.adminId,
          note: "Cliente cadastrado a partir deste atendimento.",
        },
      });
    });
    revalidateTag(ADMIN_NEW_LEADS_TAG, { expire: 0 });
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
    const session = await requireAdmin();
    await prisma.$transaction(async (tx) => {
      await tx.leadVenda.delete({ where: { id } });
      await recordAdminAudit(tx, session.adminId, id, "lead.delete", {});
    });
    revalidateTag(ADMIN_NEW_LEADS_TAG, { expire: 0 });
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
    const phone = normalizeAdminPhone(value("phone")) ?? "";
    const origin = value("origin");
    const status = value("status");
    const interestVehicleId = value("vehicle") || null;
    const nextAction = value("nextAction");
    const dateValue = value("date");
    const timeValue = value("time");
    const lostReasonRaw = value("lostReason");
    const lostReason = isLeadLossReason(lostReasonRaw) ? lostReasonRaw : null;
    const nextActionAt = dateValue ? businessDay(dateValue, timeValue) : null;
    if (!name && !phone) return { ok: false, message: "Informe o nome ou o telefone." };
    if (
      name.length > 120 ||
      (value("phone") && !phone) ||
      !isLeadOrigin(origin) ||
      !(PURCHASE_STATUSES as readonly string[]).includes(status) ||
      nextAction.length > 300 ||
      (timeValue && !dateValue) ||
      (nextActionAt && (!nextAction || Number.isNaN(nextActionAt.getTime())))
    ) {
      return { ok: false, message: "Confira nome, telefone, origem e próxima ação/data." };
    }
    await prisma.$transaction(async (tx) => {
      const existing = id
        ? await tx.leadVenda.findUnique({
            where: { id },
            select: {
              id: true,
              source: true,
              status: true,
              nextAction: true,
              nextActionAt: true,
            },
          })
        : null;
      if (id && !existing?.source?.startsWith("whatsapp:")) throw new Error("Conversa não encontrada.");
      const vehicle = interestVehicleId ? await tx.vehicle.findUnique({
        where: { id: interestVehicleId }, select: { brand: true, model: true, version: true, yearModel: true },
      }) : null;
      if (interestVehicleId && !vehicle) throw new Error("Veículo não encontrado.");
      const terminal = status === "fechado" || status === "perdido";
      const baseData = {
        name, phone, source: `whatsapp:${origin}`, status, interestVehicleId,
        vehicleInfo: vehicle ? [vehicle.brand, vehicle.model, vehicle.version, vehicle.yearModel].filter(Boolean).join(" ") : "Sem veículo definido",
        nextAction: terminal ? null : nextAction || null,
        nextActionAt: terminal ? null : nextActionAt,
      };
      let lead: { id: string };
      try {
        const fullData = {
          ...baseData,
          ...(status === "fechado"
            ? { lostReason: null }
            : lostReason
              ? { lostReason }
              : {}),
        };
        lead = id
          ? await tx.leadVenda.update({ where: { id }, data: fullData, select: { id: true } })
          : await tx.leadVenda.create({ data: fullData, select: { id: true } });
      } catch (err) {
        if (!isMissingColumnError(err)) throw err;
        lead = id
          ? await tx.leadVenda.update({ where: { id }, data: baseData, select: { id: true } })
          : await tx.leadVenda.create({ data: baseData, select: { id: true } });
      }
      if (!existing || existing.status !== status) {
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            adminId: session.adminId,
            note: `${funnelActivity(status)} ${PURCHASE_STATUS_LABEL[status as keyof typeof PURCHASE_STATUS_LABEL]}`,
          },
        });
      }
      if (!terminal && nextAction && nextActionAt) {
        const prevTime = existing?.nextActionAt ? existing.nextActionAt.getTime() : null;
        if (prevTime !== nextActionAt.getTime() || existing?.nextAction !== nextAction) {
          await tx.leadActivity.create({
            data: {
              leadId: lead.id,
              adminId: session.adminId,
              note: `[retorno:${nextActionAt.toISOString()}] Retorno agendado para ${adminActionDate(nextActionAt)}: ${nextAction}`,
            },
          });
        }
      }
      if (lostReason) {
        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            adminId: session.adminId,
            note: lossReasonActivity(lostReason),
          },
        });
      }
    });
    revalidateTag(ADMIN_NEW_LEADS_TAG, { expire: 0 });
    revalidatePath("/admin/leads");
    revalidatePath("/admin/agenda");
    expireAdminData();
    return { ok: true, message: id ? "Conversa atualizada." : "Conversa registrada." };
  } catch (error) {
    console.error("[admin/leads] falha ao registrar conversa:", error);
    return { ok: false, message: "Não foi possível salvar a conversa. Confira os dados e tente novamente." };
  }
}
