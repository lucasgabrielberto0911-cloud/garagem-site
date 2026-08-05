"use server";

import { prisma } from "@/lib/prisma";

export type SellLeadState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

export async function createSellLead(data: FormData): Promise<SellLeadState> {
  const name = text(data, "name");
  const phone = text(data, "phone");
  const brand = text(data, "brand");
  const model = text(data, "model");
  const year = text(data, "year");
  const kmRaw = text(data, "km").replace(/\D/g, "");
  const notes = text(data, "notes");

  const fieldErrors: Record<string, string> = {};
  if (name.length < 3) fieldErrors.name = "Informe seu nome completo.";
  if (phone.replace(/\D/g, "").length < 10) {
    fieldErrors.phone = "Informe um telefone com DDD.";
  }
  if (!brand) fieldErrors.brand = "Informe a marca.";
  if (!model) fieldErrors.model = "Informe o modelo.";
  if (!/^\d{4}$/.test(year)) fieldErrors.year = "Informe o ano com 4 dígitos.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      message: "Confira os campos destacados.",
      fieldErrors,
    };
  }

  const vehicleInfo = `${brand} ${model} ${year}`;

  try {
    await prisma.leadVenda.create({
      data: {
        name,
        phone,
        vehicleInfo,
        km: kmRaw ? Number(kmRaw) : null,
        notes: notes || null,
      },
    });
  } catch (error) {
    console.error("[vender] falha ao registrar lead:", error);
    return {
      ok: false,
      message:
        "Não conseguimos registrar sua solicitação agora. Tente novamente ou chame no WhatsApp.",
    };
  }

  return {
    ok: true,
    message: "Recebemos seus dados! Entraremos em contato em breve.",
  };
}
