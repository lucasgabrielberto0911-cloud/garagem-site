export const SELL_PHOTO_TIMEOUT_MS = 60_000;

/** Inclui a preparação local, que nem sempre responde ao AbortSignal. */
export async function prepareSellPhoto(file: File, signal: AbortSignal, prepare: (file: File) => Promise<File>, timeoutMs = SELL_PHOTO_TIMEOUT_MS): Promise<File> {
  if (signal.aborted) throw new DOMException("Cancelado", "AbortError");
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void;
  const stopped = new Promise<never>((_, reject) => {
    abort = () => reject(new DOMException("Cancelado", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    timer = setTimeout(() => reject(new Error("A preparação da foto demorou demais. Tente novamente.")), timeoutMs);
  });
  try { return await Promise.race([prepare(file), stopped]); }
  finally { clearTimeout(timer!); signal.removeEventListener("abort", abort!); }
}

/** Progresso real do transporte; 100% ainda espera a confirmação da API. */
export function uploadSellPhoto(file: File, signal: AbortSignal, progress: (percent: number) => void, createRequest = () => new XMLHttpRequest(), timeoutMs = SELL_PHOTO_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Cancelado", "AbortError")); return; }
    const xhr = createRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error, url?: string) => {
      signal.removeEventListener("abort", abort);
      xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = null;
      xhr.upload.onprogress = null;
      if (error) reject(error); else resolve(url!);
    };
    xhr.open("POST", "/api/vender/photos");
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.min(100, Math.round(event.loaded / event.total * 100))); };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as { url?: string; error?: string };
        if (xhr.status < 200 || xhr.status >= 300 || !data.url || typeof data.url !== "string") throw new Error(data.error || "Não foi possível enviar a foto. Tente novamente.");
        finish(undefined, data.url);
      } catch (error) { finish(error instanceof SyntaxError ? new Error("Não foi possível confirmar o envio. Tente novamente.") : error as Error); }
    };
    xhr.onerror = () => finish(new Error("A conexão falhou. Tente enviar esta foto novamente."));
    xhr.ontimeout = () => finish(new Error("O envio demorou demais. Tente novamente."));
    xhr.onabort = () => finish(new DOMException("Cancelado", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    const data = new FormData(); data.append("file", file, file.name);
    try { xhr.send(data); } catch (error) { finish(error as Error); }
  });
}
