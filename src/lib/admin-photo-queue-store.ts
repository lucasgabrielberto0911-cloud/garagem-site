type StoredQueue = { key: string; updatedAt: number; jobs: unknown[] };
function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("garagem-admin-photo-queue", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("queues", { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function photoQueueStorage(
  key: string,
  jobs?: unknown[] | null,
): Promise<StoredQueue | null> {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "queues",
        jobs === undefined ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("queues");
      const request =
        jobs === undefined
          ? store.get(key)
          : jobs === null
            ? store.delete(key)
            : store.put({ key, jobs, updatedAt: Date.now() });
      let value: StoredQueue | null = null;
      request.onsuccess = () => {
        value = jobs === undefined ? (request.result ?? null) : null;
      };
      tx.oncomplete = () =>
        resolve(
          value && value.updatedAt > Date.now() - 30 * 86400000 ? value : null,
        );
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
