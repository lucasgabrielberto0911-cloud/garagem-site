import { singleMentionedModelPool, mentionedModelPools, type ChatVehicleRecord } from "@/lib/chat-stock";
import { chatCtaIntent } from "@/lib/chat-text";
import { formatModelName } from "@/lib/format";
import type { ChatTurn } from "@/lib/chat-gemini";

export function asksChatMedia(message: string) {
  return ["photos", "video"].includes(chatCtaIntent(message) ?? "");
}

/** “Qual deles?” → “o Civic”: conserva só o pedido de mídia que ficou pendente. */
export function pendingChatMediaMessage(message: string, history: ChatTurn[], stock: ChatVehicleRecord[]) {
  if (chatCtaIntent(message) !== "question") return null;
  const last = history.at(-1);
  const previous = history.at(-2);
  if (last?.role !== "assistant" || !/^De qual (?:deles:|carro você quer fotos)/.test(last.content) ||
    previous?.role !== "user" || !asksChatMedia(previous.content) ||
    !singleMentionedModelPool(stock, message)?.length) return null;
  return `${message} ${chatCtaIntent(previous.content) === "video" ? "vídeo" : "fotos"}`;
}

export function resolveChatMediaVehicles(message: string, stock: ChatVehicleRecord[], vehicleId?: string, previousVehicleIds: string[] = []) {
  const named = singleMentionedModelPool(stock, message);
  if (named?.length === 1) return named;
  if (named?.length) {
    const years: string[] = message.match(/\b(?:19|20)\d{2}\b/g) ?? [];
    const narrowed = years.length ? named.filter(vehicle => years.includes(String(vehicle.yearModel))) : named;
    const active = narrowed.find(vehicle => vehicle.id === vehicleId);
    return active ? [active] : narrowed.slice(0, 3);
  }
  const models = mentionedModelPools(stock, message);
  if (models.length > 1) return models.flatMap(pool => pool.slice(0, 1)).slice(0, 3);
  const active = stock.find(vehicle => vehicle.id === vehicleId);
  if (active) return [active];
  return [...new Set(previousVehicleIds)].flatMap(id => {
    const vehicle = stock.find(unit => unit.id === id);
    return vehicle ? [vehicle] : [];
  }).slice(0, 3);
}

export function chatMediaVehicleName(vehicle: ChatVehicleRecord) {
  return `${formatModelName(vehicle.model)} ${vehicle.yearModel}`;
}
