"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SiteSettingsState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

async function requireAdmin() {
  const session = await getSession();
  if (!session?.adminId) redirect("/admin/login");
  return session;
}

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

export async function updateSiteSettings(
  formData: FormData,
): Promise<SiteSettingsState> {
  await requireAdmin();

  const region = text(formData, "region");
  const email = text(formData, "email");
  const address = text(formData, "address");
  const hours = text(formData, "hours");
  const hoursWeekdays = text(formData, "hoursWeekdays");
  const hoursSaturday = text(formData, "hoursSaturday");

  const fieldErrors: Record<string, string> = {};
  if (region.length < 2) fieldErrors.region = "Informe a cidade ou região.";
  if (email && !email.includes("@")) fieldErrors.email = "E-mail inválido.";
  if (address.length < 5) {
    fieldErrors.address = "Informe o endereço ou a modalidade (ex.: loja digital).";
  }
  if (hours.length < 2) fieldErrors.hours = "Informe o horário resumido.";
  if (hoursWeekdays.length < 2) {
    fieldErrors.hoursWeekdays = "Informe o horário de segunda a sexta.";
  }
  if (hoursSaturday.length < 2) {
    fieldErrors.hoursSaturday = "Informe o horário de sábado.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Corrija os campos destacados.", fieldErrors };
  }

  try {
    await prisma.siteSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        region,
        email: email || null,
        address,
        hours,
        hoursWeekdays,
        hoursSaturday,
      },
      update: {
        region,
        email: email || null,
        address,
        hours,
        hoursWeekdays,
        hoursSaturday,
      },
    });
  } catch (error) {
    console.error("[admin/site] falha ao salvar:", error);
    return {
      ok: false,
      message: "Não foi possível salvar. Confira a conexão com o banco.",
    };
  }

  revalidatePath("/");
  revalidatePath("/contato");
  revalidatePath("/sobre");
  revalidatePath("/admin");
  revalidatePath("/admin/site");

  return { ok: true, message: "Dados do site atualizados." };
}
