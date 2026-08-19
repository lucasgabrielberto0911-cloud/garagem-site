"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { isValidPlate, normalizePlate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { checkSellLeadRateLimit } from "@/lib/rate-limit";
import { ADMIN_NEW_LEADS_TAG } from "@/lib/admin-cache";

export type SellLeadState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
};

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

function clientKey() {
  const h = headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

export async function createSellLead(data: FormData): Promise<SellLeadState> {
  // Honeypot: bots preenchem campos ocultos; humanos não veem.
  if (text(data, "website")) {
    return {
      ok: true,
      message: "Recebemos seus dados! Entraremos em contato em breve.",
    };
  }

  const limited = checkSellLeadRateLimit(clientKey());
  if (!limited.ok) {
    return {
      ok: false,
      message: `Muitas solicitações. Tente de novo em ${limited.retryAfterSec}s ou chame no WhatsApp.`,
    };
  }

  const name = text(data, "name");
  const phone = text(data, "phone");
  const brand = text(data, "brand");
  const model = text(data, "model");
  const year = text(data, "year");
  const plate = normalizePlate(text(data, "plate"));
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
  if (!plate) {
    fieldErrors.plate = "Informe a placa do veículo.";
  } else if (!isValidPlate(plate)) {
    fieldErrors.plate =
      "Placa inválida. Use o formato antigo (ABC-1234) ou Mercosul (ABC1D23).";
  }

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
        plate,
        km: kmRaw ? Number(kmRaw) : null,
        notes: notes || null,
      },
    });
    revalidateTag(ADMIN_NEW_LEADS_TAG);
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
