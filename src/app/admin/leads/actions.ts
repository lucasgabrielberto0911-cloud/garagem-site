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
