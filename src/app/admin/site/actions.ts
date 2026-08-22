"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { parseFaqItems } from "@/lib/faq";
import { prisma } from "@/lib/prisma";
import { parseConditionItems } from "@/lib/site-content";

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

function parseJsonField(data: FormData, key: string): unknown {
  const raw = String(data.get(key) ?? "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseGoogleRating(raw: string) {
  if (!raw) return 0;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 5) return null;
  return Math.round(value * 10) / 10;
}

function nonNegativeInt(data: FormData, key: string) {
  const raw = String(data.get(key) ?? "").replace(/\D/g, "");
  if (!raw) return 0;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
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
  const aboutYears = text(formData, "aboutYears") || "+20";
  const aboutHours = text(formData, "aboutHours") || "8h–23h";
  const aboutFocus = text(formData, "aboutFocus") || "100%";
  const statsStockBase = nonNegativeInt(formData, "statsStockBase");
  const statsSalesBase = nonNegativeInt(formData, "statsSalesBase");
  const googleRating = parseGoogleRating(text(formData, "googleRating"));
  const googleReviewCount = nonNegativeInt(formData, "googleReviewCount");
  const googleProfileUrl = text(formData, "googleProfileUrl");
  const faqItems = parseFaqItems(parseJsonField(formData, "faqJson"));
  const conditionsTitle =
    text(formData, "conditionsTitle") || "Garantia de 3 Meses Garagem";
  const conditionsIntro = text(formData, "conditionsIntro");
  const conditionsItems = parseConditionItems(
    parseJsonField(formData, "conditionsJson"),
  );

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
  if (googleRating === null) {
    fieldErrors.googleRating = "Use uma nota de 0 a 5 (ex.: 4,8).";
  }
  if (googleReviewCount > 0 && googleRating === 0) {
    fieldErrors.googleRating = "Informe a nota se já houver avaliações.";
  }
  if (
    (googleRating ?? 0) > 0 &&
    googleReviewCount > 0 &&
    googleProfileUrl &&
    !/^https?:\/\//i.test(googleProfileUrl)
  ) {
    fieldErrors.googleProfileUrl = "Cole a URL completa do perfil no Google.";
  }
  if (
    (googleRating ?? 0) > 0 &&
    googleReviewCount > 0 &&
    !googleProfileUrl
  ) {
    fieldErrors.googleProfileUrl =
      "Cole o link do Google Meu Negócio para o selo aparecer.";
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
        aboutYears,
        aboutHours,
        aboutFocus,
        statsStockBase,
        statsSalesBase,
        // Mantém aboutSold alinhado para leitores legados.
        aboutSold: String(statsSalesBase),
        googleRating: googleRating ?? 0,
        googleReviewCount,
        googleProfileUrl: googleProfileUrl || null,
        faqJson: faqItems ?? Prisma.DbNull,
        conditionsTitle,
        conditionsIntro: conditionsIntro || null,
        conditionsJson: conditionsItems ?? Prisma.DbNull,
      },
      update: {
        region,
        email: email || null,
        address,
        hours,
        hoursWeekdays,
        hoursSaturday,
        aboutYears,
        aboutHours,
        aboutFocus,
        statsStockBase,
        statsSalesBase,
        aboutSold: String(statsSalesBase),
        googleRating: googleRating ?? 0,
        googleReviewCount,
        googleProfileUrl: googleProfileUrl || null,
        faqJson: faqItems ?? Prisma.DbNull,
        conditionsTitle,
        conditionsIntro: conditionsIntro || null,
        conditionsJson: conditionsItems ?? Prisma.DbNull,
      },
    });
  } catch (error) {
    console.error("[admin/site] falha ao salvar:", error);
    return {
      ok: false,
      message: "Não foi possível salvar. Confira a conexão com o banco.",
    };
  }

  revalidateTag("site-settings");
  revalidatePath("/");
  revalidatePath("/faq");
  revalidatePath("/contato");
  revalidatePath("/sobre");
  revalidatePath("/estoque");
  revalidatePath("/admin");
  revalidatePath("/admin/site");

  return { ok: true, message: "Dados do site atualizados." };
}
