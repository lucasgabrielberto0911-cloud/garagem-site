/**
 * Fila de intenções offline: WhatsApp, formulário de venda e favoritos.
 * IndexedDB no aparelho — sem PII além do que o visitante já digitou.
 */

export const OFFLINE_QUEUE_DB = "garagem-offline";
export const OFFLINE_QUEUE_STORE = "intents";
export const FAVORITE_SNAPSHOT_KEY = "garagem:favoritos-snapshots";

export type WhatsAppIntent = {
  type: "whatsapp";
  url: string;
  label?: string;
  vehicleId?: string;
};

export type SellIntent = {
  type: "sell";
  fields: Record<string, string>;
  photoUrls?: string[];
};

export type FavoriteIntent = {
  type: "favorite";
  vehicleId: string;
  added: boolean;
};

export type OfflineIntent = (WhatsAppIntent | SellIntent | FavoriteIntent) & {
  id: string;
  createdAt: number;
};

export function isLikelyNetworkFailure(error?: unknown, online = true) {
  if (!online) return true;
  if (!error) return false;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|load failed|network request failed/i.test(
    message,
  );
}

export function createIntentId(now = Date.now()) {
  return `q-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_QUEUE_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IDB"));
  });
}

export type OfflineIntentDraft =
  | (WhatsAppIntent & { id?: string; createdAt?: number })
  | (SellIntent & { id?: string; createdAt?: number })
  | (FavoriteIntent & { id?: string; createdAt?: number });

export async function enqueueIntent(intent: OfflineIntentDraft) {
  const row = {
    ...intent,
    id: intent.id ?? createIntentId(),
    createdAt: intent.createdAt ?? Date.now(),
  } as OfflineIntent;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    tx.objectStore(OFFLINE_QUEUE_STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB put"));
  });
  db.close();
  return row;
}

export async function listIntents(): Promise<OfflineIntent[]> {
  const db = await openDb();
  const rows = await new Promise<OfflineIntent[]>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readonly");
    const request = tx.objectStore(OFFLINE_QUEUE_STORE).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as OfflineIntent[]);
    request.onerror = () => reject(request.error ?? new Error("IDB getAll"));
  });
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteIntent(id: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    tx.objectStore(OFFLINE_QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB delete"));
  });
  db.close();
}

export type FavoriteSnapshot = {
  id: string;
  category?: string;
  brand: string;
  model: string;
  version: string | null;
  yearModel: number;
  km: number;
  price: number;
  transmission: string;
  fuel: string;
  status: string;
  featured: boolean;
  color?: string | null;
  updatedAt?: string | null;
  photos: Array<{ url: string; thumbnailUrl?: string | null }>;
};

function favoriteStorage() {
  try {
    const store =
      (typeof window !== "undefined" && window.localStorage) ||
      (globalThis as { localStorage?: Storage }).localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

export function readFavoriteSnapshots(): Record<string, FavoriteSnapshot> {
  const storage = favoriteStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(FAVORITE_SNAPSHOT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, FavoriteSnapshot>;
  } catch {
    return {};
  }
}

export function writeFavoriteSnapshot(vehicle: FavoriteSnapshot) {
  const storage = favoriteStorage();
  if (!storage) return;
  const current = readFavoriteSnapshots();
  current[vehicle.id] = {
    ...vehicle,
    updatedAt:
      typeof vehicle.updatedAt === "string"
        ? vehicle.updatedAt
        : vehicle.updatedAt
          ? String(vehicle.updatedAt)
          : null,
  };
  storage.setItem(FAVORITE_SNAPSHOT_KEY, JSON.stringify(current));
}

export function snapshotsForIds(ids: string[]): FavoriteSnapshot[] {
  const store = readFavoriteSnapshots();
  return ids.map((id) => store[id]).filter((item): item is FavoriteSnapshot => Boolean(item));
}
