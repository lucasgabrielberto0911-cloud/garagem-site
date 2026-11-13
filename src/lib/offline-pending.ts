import {
  isIntentExpired,
  OFFLINE_INTENT_TTL_MS,
  type OfflineIntent,
} from "./offline-queue";

export type PendingIntentView = {
  id: string;
  type: "whatsapp" | "sell";
  title: string;
  /** Quanto falta para o pedido expirar e ser descartado sem enviar. */
  timeLeft: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatIntentTimeLeft(ms: number): string {
  if (ms < DAY_MS) return "menos de 1 dia";
  const days = Math.floor(ms / DAY_MS);
  return days === 1 ? "1 dia" : `${days} dias`;
}

/** Pedidos que o visitante pode revisar. Favoritos são enviados em silêncio e não aparecem. Sem dados pessoais. */
export function pendingIntentViews(
  intents: readonly OfflineIntent[],
  now = Date.now(),
): PendingIntentView[] {
  const views: PendingIntentView[] = [];
  for (const item of intents) {
    if (item.type !== "whatsapp" && item.type !== "sell") continue;
    if (isIntentExpired(item, now)) continue;
    views.push({
      id: item.id,
      type: item.type,
      title:
        item.type === "sell"
          ? "Pedido de avaliação do seu carro"
          : item.label?.trim() || "Recado de interesse para o WhatsApp",
      timeLeft: formatIntentTimeLeft(item.createdAt + OFFLINE_INTENT_TTL_MS[item.type] - now),
    });
  }
  return views;
}
