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
  claimedAt?: number;
};

export const OFFLINE_INTENT_TTL_MS: Record<OfflineIntent["type"], number> = {
  whatsapp: 24 * 60 * 60 * 1000,
  favorite: 24 * 60 * 60 * 1000,
  sell: 72 * 60 * 60 * 1000,
};

export const OFFLINE_CLAIM_LEASE_MS = 60_000;

export function isIntentExpired(
  intent: Pick<OfflineIntent, "type" | "createdAt">,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(intent.createdAt)) return true;
  const ttl = OFFLINE_INTENT_TTL_MS[intent.type] ?? OFFLINE_INTENT_TTL_MS.whatsapp;
  return now - intent.createdAt > ttl;
}

export function filterValidIntents(
  intents: readonly OfflineIntent[],
  now = Date.now(),
): { valid: OfflineIntent[]; expiredIds: string[] } {
  const valid: OfflineIntent[] = [];
  const expiredIds: string[] = [];
  for (const item of intents) {
    if (isIntentExpired(item, now)) {
      expiredIds.push(item.id);
    } else {
      valid.push(item);
    }
  }
  valid.sort((a, b) => a.createdAt - b.createdAt);
  return { valid, expiredIds };
}

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

export async function listIntents(now = Date.now()): Promise<OfflineIntent[]> {
  const db = await openDb();
  const rows = await new Promise<OfflineIntent[]>((resolve, reject) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readonly");
    const request = tx.objectStore(OFFLINE_QUEUE_STORE).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as OfflineIntent[]);
    request.onerror = () => reject(request.error ?? new Error("IDB getAll"));
  });
  const { valid, expiredIds } = filterValidIntents(rows, now);
  if (expiredIds.length > 0) {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
      const store = tx.objectStore(OFFLINE_QUEUE_STORE);
      for (const id of expiredIds) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }
  db.close();
  return valid;
}

export async function claimIntent(
  id: string,
  now = Date.now(),
  leaseMs = OFFLINE_CLAIM_LEASE_MS,
): Promise<boolean> {
  const db = await openDb();
  const claimed = await new Promise<boolean>((resolve) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_QUEUE_STORE);
    const getReq = store.get(id);
    let ok = false;
    getReq.onsuccess = () => {
      const current = getReq.result as OfflineIntent | undefined;
      if (!current || isIntentExpired(current, now)) {
        if (current) store.delete(id);
        return;
      }
      if (current.claimedAt && now - current.claimedAt < leaseMs) {
        return;
      }
      store.put({ ...current, claimedAt: now });
      ok = true;
    };
    tx.oncomplete = () => resolve(ok);
    tx.onerror = () => resolve(false);
  });
  db.close();
  return claimed;
}

export async function releaseIntentClaim(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    const store = tx.objectStore(OFFLINE_QUEUE_STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const current = getReq.result as OfflineIntent | undefined;
      if (!current || !current.claimedAt) return;
      const next = { ...current };
      delete next.claimedAt;
      store.put(next);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
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
  locationCity?: string | null;
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

/** Uma leitura/gravação para o conjunto de cards, sem bloquear cada anúncio. */
export function writeFavoriteSnapshots(vehicles: readonly FavoriteSnapshot[]) {
  if (vehicles.length === 0) return;
  const storage = favoriteStorage();
  if (!storage) return;
  try {
    const current = readFavoriteSnapshots();
    for (const vehicle of vehicles) {
      current[vehicle.id] = {
        ...vehicle,
        updatedAt: vehicle.updatedAt == null ? null : String(vehicle.updatedAt),
      };
    }
    storage.setItem(FAVORITE_SNAPSHOT_KEY, JSON.stringify(current));
  } catch {
    // Sem espaço/permissão para o cache offline, o anúncio segue utilizável.
  }
}

export function writeFavoriteSnapshot(vehicle: FavoriteSnapshot) {
  writeFavoriteSnapshots([vehicle]);
}

export function snapshotsForIds(ids: string[]): FavoriteSnapshot[] {
  const store = readFavoriteSnapshots();
  return ids.map((id) => store[id]).filter((item): item is FavoriteSnapshot => Boolean(item));
}
