import type { ChatVehicleCard } from "@/lib/chat-cards";
import type { ChatResearch } from "@/lib/chat-research-data";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  vehicles?: ChatVehicleCard[];
  stockHref?: string | null;
  leadCreated?: boolean;
  research?: ChatResearch;
  searchContext?: ChatSearchContext;
};

export type ChatSearchContext = { searchHistory: Array<{ role: "user"; content: string }>; shownVehicleIds: string[] };

/** O histórico visual pode ser curto; os filtros e as unidades vistas duram a conversa. */
export function chatSearchContext(messages: ChatMessage[]): ChatSearchContext {
  const lastContextIndex = messages.findLastIndex(message => message.searchContext);
  const previous = messages[lastContextIndex]?.searchContext;
  const recent = messages.slice(lastContextIndex + 1);
  return {
    searchHistory: [...(previous?.searchHistory ?? []), ...recent.filter(message => message.role === "user").map(({ content }) => ({ role: "user" as const, content: content.slice(0, 800) }))].slice(-100),
    shownVehicleIds: [...new Set([...(previous?.shownVehicleIds ?? []), ...recent.flatMap(message => message.role === "assistant" ? (message.vehicles ?? []).map(vehicle => vehicle.id) : [])])].slice(-500),
  };
}

/**
 * Depois de um erro a pergunta fica no histórico e volta ao campo. Ao reenviar o mesmo texto,
 * a tentativa anterior sai antes de acrescentar o novo turno, para não duplicar a pergunta.
 */
export function withoutFailedAttempt(messages: ChatMessage[], text: string): ChatMessage[] {
  const last = messages[messages.length - 1];
  return last?.role === "user" && last.content.trim() === text.trim() ? messages.slice(0, -1) : messages;
}

function readSearchContext(raw: unknown): ChatSearchContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Partial<ChatSearchContext>;
  const searchHistory = Array.isArray(value.searchHistory) ? value.searchHistory.slice(-100).flatMap(turn => turn?.role === "user" && typeof turn.content === "string" && turn.content.trim() ? [{ role: "user" as const, content: turn.content.slice(0, 800) }] : []) : [];
  const shownVehicleIds = Array.isArray(value.shownVehicleIds) ? [...new Set(value.shownVehicleIds.filter(id => typeof id === "string" && id.length > 0 && id.length <= 100))].slice(-500) : [];
  return { searchHistory, shownVehicleIds };
}

export function readVehicleCards(raw: unknown): ChatVehicleCard[] {
  if (!Array.isArray(raw)) return [];
  const cards: ChatVehicleCard[] = [];
  for (const item of raw.slice(0, 3)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<ChatVehicleCard>;
    const id = String(row.id ?? "").trim();
    const href = String(row.href ?? "").trim();
    const title = String(row.title ?? "").trim();
    if (
      !id ||
      id.length > 100 ||
      !title ||
      !/^\/estoque\/[a-z0-9-]+$/i.test(href)
    )
      continue;
    if (
      ![row.year, row.km, row.price].every(
        (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
      )
    )
      continue;
    const photoRaw = String(row.photo ?? "").trim();
    const photo =
      /^https:\/\//i.test(photoRaw) || /^\/(?!\/)/.test(photoRaw)
        ? photoRaw
        : null;
    cards.push({
      id,
      href,
      title,
      brand: String(row.brand ?? "").trim() || title,
      model: String(row.model ?? "").trim() || title,
      version: row.version ? String(row.version).slice(0, 200) : null,
      year: Number(row.year) || 0,
      km: Number(row.km) || 0,
      price: row.sold === true ? 0 : Number(row.price) || 0,
      ...(row.sold === true ? { sold: true } : {}),
      color: row.color ? String(row.color) : null,
      transmission: row.transmission ? String(row.transmission) : null,
      category: row.category ? String(row.category) : undefined,
      photo,
    });
  }
  return cards;
}

export const CHAT_HISTORY_KEY = "garagem_site_chat_history_v3";
export const CHAT_HISTORY_TTL = 24 * 60 * 60 * 1000;
export const CHAT_HISTORY_MESSAGES = 24;
/** Preço e status dos cards guardados valem por pouco tempo; depois disso só o texto da conversa volta. */
export const CHAT_HISTORY_CARD_TTL = 60 * 60 * 1000;
const MAX_CONTEXTS = 8;

export type ChatHistoryStore = {
  v: 3;
  byKey: Record<string, ChatMessage[]>;
  savedAt: Record<string, number>;
};

export function emptyHistory(): ChatHistoryStore {
  return { v: 3, byKey: {}, savedAt: {} };
}

/** Treat local history as untrusted, and never retain unfinished replies. */
export function parseChatHistory(
  raw: string | null,
  now = Date.now(),
): ChatHistoryStore {
  const store = emptyHistory();
  if (!raw || raw.length > 300_000) return store;
  try {
    const value = JSON.parse(raw);
    if (value?.v !== 3 || !value.byKey || !value.savedAt) return store;
    for (const key of Object.keys(value.byKey).slice(-MAX_CONTEXTS)) {
      if (!/^(site|vehicle:\/estoque\/[a-z0-9-]+)$/.test(key)) continue;
      const savedAt = value.savedAt[key];
      if (
        typeof savedAt !== "number" ||
        !Number.isFinite(savedAt) ||
        savedAt > now ||
        now - savedAt >= CHAT_HISTORY_TTL
      )
        continue;
      const rows = value.byKey[key];
      if (!Array.isArray(rows)) continue;
      const messages: ChatMessage[] = [];
      for (const row of rows.slice(-CHAT_HISTORY_MESSAGES)) {
        if (
          !row ||
          !["user", "assistant"].includes(row.role) ||
          typeof row.content !== "string" ||
          !row.content.trim()
        )
          continue;
        messages.push({
          role: row.role,
          content: row.content.slice(0, 5_000),
          ...(row.searchContext ? { searchContext: readSearchContext(row.searchContext) } : {}),
          ...(row.role === "assistant"
            ? {
                vehicles: readVehicleCards(row.vehicles),
                stockHref:
                  typeof row.stockHref === "string" &&
                  /^\/estoque(?:\?|$)/.test(row.stockHref)
                    ? row.stockHref.slice(0, 800)
                    : null,
                leadCreated: row.leadCreated === true,
              }
            : {}),
        });
      }
      if (messages.length && now - savedAt >= CHAT_HISTORY_CARD_TTL) {
        // O anúncio pode ter mudado de preço ou saído do estoque: não restaura cards velhos,
        // mas mantém os ids já mostrados para o assistente não repetir as mesmas unidades.
        const context = chatSearchContext(messages);
        for (const message of messages) {
          delete message.vehicles;
          delete message.stockHref;
        }
        messages[messages.length - 1] = { ...messages[messages.length - 1]!, searchContext: context };
      }
      if (messages.length) {
        store.byKey[key] = messages;
        store.savedAt[key] = savedAt;
      }
    }
  } catch {
    /* Storage may be blocked or malformed; chat still works. */
  }
  return store;
}

export function readHistoryStore(): ChatHistoryStore {
  try {
    // Older histories had no timestamp. Do not revive stale stock prices.
    sessionStorage.removeItem("garagem_site_chat_history_v1");
    sessionStorage.removeItem("garagem_site_chat_history_v2");
    return parseChatHistory(sessionStorage.getItem(CHAT_HISTORY_KEY));
  } catch {
    return emptyHistory();
  }
}

export function writeHistoryStore(store: ChatHistoryStore) {
  try {
    sessionStorage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify(parseChatHistory(JSON.stringify(store))),
    );
  } catch {
    /* Chat works without storage. */
  }
}

export function saveHistoryForKey(key: string, messages: ChatMessage[]) {
  const store = readHistoryStore();
  delete store.byKey[key];
  delete store.savedAt[key];
  if (messages.length > 1) {
    const saved = messages.slice(-CHAT_HISTORY_MESSAGES);
    saved[saved.length - 1] = { ...saved[saved.length - 1], searchContext: chatSearchContext(messages) };
    store.byKey[key] = saved;
    store.savedAt[key] = Date.now();
  }
  writeHistoryStore(store);
}
