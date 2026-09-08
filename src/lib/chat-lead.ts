import { revalidateTag } from "next/cache";
import { ADMIN_NEW_LEADS_TAG } from "@/lib/admin-cache";
import {
  matchInterestVehicle,
  type ChatVehicleRecord,
} from "@/lib/chat-stock";
import { sanitizeSensitiveText } from "@/lib/chat-guard";
import { notifyNewLead } from "@/lib/lead-notify";
import { createLeadVenda } from "@/lib/lead-venda";

export type CriarLeadArgs = {
  nome?: string;
  telefone?: string;
  veiculo_interesse?: string;
  mensagem?: string;
};

export function parseCriarLeadArgs(raw: unknown): CriarLeadArgs | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const text = (key: string) =>
    typeof data[key] === "string" ? data[key].trim() : "";
  return {
    nome: sanitizeSensitiveText(text("nome")),
    telefone: text("telefone"),
    veiculo_interesse: sanitizeSensitiveText(text("veiculo_interesse")),
    mensagem: sanitizeSensitiveText(text("mensagem")),
  };
}

export function leadArgsAreComplete(args: CriarLeadArgs | null) {
  if (!args) return false;
  const name = args.nome?.trim() ?? "";
  const phoneDigits = (args.telefone ?? "").replace(/\D/g, "");
  return name.length >= 3 && phoneDigits.length >= 10;
}

export async function createChatLead(
  args: CriarLeadArgs,
  stock: ChatVehicleRecord[],
) {
  const name = sanitizeSensitiveText(args.nome ?? "");
  const phone = (args.telefone ?? "").replace(/\D/g, "");
  const interest = sanitizeSensitiveText(args.veiculo_interesse ?? "");
  const message = sanitizeSensitiveText(args.mensagem ?? "");
  const match = matchInterestVehicle(interest, stock);

  const lead = await createLeadVenda({
    name,
    phone,
    vehicleInfo: interest || "Interesse via chatbot",
    plate: "",
    km: null,
    notes: message || null,
    interestVehicleId: match?.id ?? null,
    source: "chatbot-site",
    photoUrls: [],
  });

  revalidateTag(ADMIN_NEW_LEADS_TAG, "max");
  notifyNewLead({
    id: lead.id,
    name,
    phone,
    vehicleInfo: interest || "Interesse via chatbot",
    notes: message || null,
    source: "chatbot-site",
    interestVehicleId: match?.id ?? null,
  });

  return { id: lead.id, matchedVehicleId: match?.id ?? null };
}
