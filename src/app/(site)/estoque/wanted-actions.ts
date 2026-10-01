"use server";

import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import { ADMIN_NEW_LEADS_TAG } from "@/lib/admin-cache";
import { notifyNewLead } from "@/lib/lead-notify";
import { createLeadVenda } from "@/lib/lead-venda";
import { checkWantedLeadRateLimit } from "@/lib/rate-limit";
import {
  parseWantedLeadForm,
  toLeadVendaData,
  WANTED_LEAD_FAILURE,
  WANTED_LEAD_SUCCESS,
  type WantedLeadState,
} from "@/lib/wanted-lead";

function text(data: FormData, key: string) {
  return String(data.get(key) ?? "").trim();
}

async function clientKey() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

export async function createWantedLead(
  data: FormData,
): Promise<WantedLeadState> {
  if (text(data, "website")) {
    return { ok: true, message: WANTED_LEAD_SUCCESS };
  }

  const parsed = parseWantedLeadForm(data);
  if (!parsed.ok) {
    return {
      ok: false,
      message: parsed.message,
      fieldErrors: parsed.fieldErrors,
    };
  }
  if (parsed.ignored || !parsed.lead) {
    return { ok: true, message: WANTED_LEAD_SUCCESS };
  }

  const limited = await checkWantedLeadRateLimit(await clientKey());
  if (!limited.ok) {
    return {
      ok: false,
      message: `Muitos pedidos agora. Tente de novo em ${limited.retryAfterSec}s.`,
    };
  }

  const record = toLeadVendaData(parsed.lead);

  try {
    const lead = await createLeadVenda(record);
    revalidateTag(ADMIN_NEW_LEADS_TAG, "max");
    notifyNewLead({
      id: lead.id,
      name: record.name,
      phone: record.phone,
      vehicleInfo: record.vehicleInfo,
      notes: record.notes,
      source: record.source,
      interestVehicleId: record.interestVehicleId,
    });
  } catch (error) {
    console.error("[nao-encontrou] falha ao registrar lead:", error);
    return { ok: false, message: WANTED_LEAD_FAILURE };
  }

  return { ok: true, message: WANTED_LEAD_SUCCESS };
}
