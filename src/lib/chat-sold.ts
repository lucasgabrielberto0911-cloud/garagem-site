import { singleMentionedModelPool, type ChatVehicleRecord } from "@/lib/chat-stock";
import { parsePriceLimit, vehicleBodyStyle } from "@/lib/chat-prompt";
import { isAnaphoricVehicleFollowUp, chatCtaIntent } from "@/lib/chat-text";
import { formatModelName } from "@/lib/format";

/** Identidade pública mínima: vendido nunca entra em card, prompt ou mensagem com preço. */
export type ChatSoldVehicle = Pick<ChatVehicleRecord, "id" | "brand" | "model" | "version" | "yearModel" | "category" | "transmission">;

const fold = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function matchChatSoldVehicle(message: string, available: ChatVehicleRecord[], sold: ChatSoldVehicle[], vehicleId?: string) {
  const pool = singleMentionedModelPool([...available, ...sold], message);
  const onlyMedia = ["photos", "video"].includes(chatCtaIntent(message) ?? "") &&
    fold(message).split(" ").every(word => /^(?:tem|manda|mandar|envia|enviar|quero|me|mais|fotos?|videos?|um|uma|por|favor|pode|mostrar|ver|do|da|de|carro|moto|veiculo)$/.test(word));
  const genericFact = /^(?:qual (?:e o )?(?:preco|valor)|quanto custa|ainda tem|esta disponivel|ta disponivel)$/.test(fold(message));
  if (!pool?.length) return vehicleId && (isAnaphoricVehicleFollowUp(message) || onlyMedia || genericFact)
    ? sold.find(vehicle => vehicle.id === vehicleId) : undefined;
  const asked = ` ${fold(message)} `;
  const years: string[] = message.match(/\b(?:19|20)\d{2}\b/g) ?? [];
  const trims = [...new Set(pool.map(vehicle => fold(vehicle.version ?? "").split(" ")[0] ?? ""))]
    .filter(trim => /^[a-z][a-z0-9]{2,}$/.test(trim) && asked.includes(` ${trim} `));
  // “Corolla XEi/Cross” não pode virar “Altis vendido” só porque cita Corolla.
  const model = fold(pool[0]!.model);
  const afterModel = asked.split(` ${model} `)[1]?.trim().split(" ")[0];
  const requestWord = /^(?:ai|aqui|ainda|agora|tambem|disponivel|vendido|automatico|manual|cvt|flex|diesel|gasolina|turbo|no|na|em|de|do|da|para|pra|com|sem|que|quanto|qual|tem|ou|e|por|ate)$/;
  if (afterModel && /^[a-z]{2,}$/.test(afterModel) && !requestWord.test(afterModel) &&
    !pool.some(vehicle => fold(vehicle.version ?? "").split(" ").includes(afterModel))) return undefined;
  const matches = pool.filter(vehicle =>
    (!years.length || years.includes(String(vehicle.yearModel))) &&
    (!trims.length || trims.includes(fold(vehicle.version ?? "").split(" ")[0] ?? "")));
  if (matches.some(vehicle => available.some(unit => unit.id === vehicle.id))) return undefined;
  return matches.find(vehicle => sold.some(unit => unit.id === vehicle.id));
}

/** Sem consultar preço antigo: usa carroceria, categoria, ano, câmbio e orçamento informado. */
export function similarToChatSoldVehicle(sold: ChatSoldVehicle, stock: ChatVehicleRecord[], message: string) {
  const body = vehicleBodyStyle(sold);
  const budget = parsePriceLimit(message);
  const candidates = stock.filter(vehicle =>
    (vehicle.category ?? "carro") === (sold.category ?? "carro") &&
    (budget == null || vehicle.price <= budget));
  const score = (vehicle: ChatVehicleRecord) =>
    (body && vehicleBodyStyle(vehicle) !== body ? 100 : 0) +
    (fold(vehicle.transmission) !== fold(sold.transmission) ? 10 : 0) +
    Math.abs(vehicle.yearModel - sold.yearModel);
  return [...candidates].sort((a, b) => score(a) - score(b) || a.price - b.price).slice(0, 3);
}

export function chatSoldVehicleName(vehicle: ChatSoldVehicle) {
  return [formatModelName(vehicle.model), vehicle.version, vehicle.yearModel].filter(Boolean).join(" ");
}
