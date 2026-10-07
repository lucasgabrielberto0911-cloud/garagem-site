export const STOCK_REQUEST_TIMEOUT_MS = 15_000;

/** Limita a requisição inteira, incluindo o corpo, sem confundir timeout com navegação. */
export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = STOCK_REQUEST_TIMEOUT_MS,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  const external = init.signal;
  if (external?.aborted) throw external.reason ?? new DOMException("Cancelado", "AbortError");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let onAbort: () => void;
  const stopped = new Promise<never>((_, reject) => {
    onAbort = () => {
      reject(external?.reason ?? new DOMException("Cancelado", "AbortError"));
      controller.abort();
    };
    external?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      reject(new DOMException("A conexão demorou demais", "TimeoutError"));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, { ...init, signal: controller.signal });
        if (!response.ok) throw new Error("Não foi possível carregar os dados");
        return await response.json() as T;
      })(),
      stopped,
    ]);
  } finally {
    clearTimeout(timer!);
    external?.removeEventListener("abort", onAbort!);
  }
}
