"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { isLeadStatus } from "@/lib/leads";
import { prisma } from "@/lib/prisma";

export type LeadActionState = { ok: boolean; message: string };

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Sessão expirada.");
}

export async function updateLeadStatus(
  id: string,
  status: string,
): Promise<LeadActionState> {
  try {
    await requireAdmin();

    if (!isLeadStatus(status)) {
      return { ok: false, message: "Status inválido." };
    }

    await prisma.leadVenda.update({ where: { id }, data: { status } });
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
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
    const existing = await prisma.customer.findFirst({ where: { phone } });
    if (existing) {
      return {
        ok: false,
        message: `${existing.name} já está no cadastro de clientes.`,
      };
    }

    await prisma.customer.create({
      data: {
        name: lead.name,
        phone,
        notes: `Lead de venda/troca: ${lead.vehicleInfo}${
          lead.notes ? ` — ${lead.notes}` : ""
        }`,
      },
    });

    revalidatePath("/admin/clientes");
    return { ok: true, message: "Cliente criado a partir do lead." };
  } catch (error) {
    console.error("[admin/leads] falha ao converter lead:", error);
    return { ok: false, message: "Não foi possível criar o cliente." };
  }
}

export async function deleteLead(id: string): Promise<LeadActionState> {
  try {
    await requireAdmin();
    await prisma.leadVenda.delete({ where: { id } });
    revalidatePath("/admin/leads");
    revalidatePath("/admin");
    return { ok: true, message: "Lead removido." };
  } catch (error) {
    console.error("[admin/leads] falha ao remover lead:", error);
    return { ok: false, message: "Não foi possível remover o lead." };
  }
}
