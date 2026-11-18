/**
 * Helper para operações de fotos públicas no Cloudflare R2.
 * Substitui o bucket `veiculos` do Supabase para novas fotos, eliminando custos de egress.
 *
 * Variáveis necessárias no ambiente (Vercel):
 * - R2_ACCOUNT_ID
 * - R2_BUCKET
 * - R2_PUBLIC_URL (ex.: https://pub-xxxx.r2.dev ou domínio customizado)
 * - R2_API_TOKEN  (token da API Cloudflare, Authorization: Bearer)
 *
 * NOTA DE SEGURANÇA: tokens e credenciais NUNCA devem ser logados nem expostos em erros.
 */

export type R2Config = {
  accountId: string;
  bucket: string;
  publicUrl: string;
  apiToken: string;
};

/**
 * Modo R2: qualquer variável R2_* presente. Config parcial falha fechado
 * (erro no upload) em vez de voltar a gravar foto pública no Supabase.
 */
export function hasAnyR2Config(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID ||
      process.env.R2_BUCKET ||
      process.env.R2_PUBLIC_URL ||
      process.env.R2_API_TOKEN,
  );
}

/** Verifica se todas as 4 variáveis de configuração do R2 estão presentes. */
export function hasR2Config(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_BUCKET?.trim() &&
      process.env.R2_PUBLIC_URL?.trim() &&
      process.env.R2_API_TOKEN?.trim(),
  );
}

/**
 * Lê e valida as configurações do R2.
 * Lança erro claro se faltar qualquer variável, sem expor valores sensíveis.
 */
export function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim();
  const apiToken = process.env.R2_API_TOKEN?.trim();

  const missing: string[] = [];
  if (!accountId) missing.push("R2_ACCOUNT_ID");
  if (!bucket) missing.push("R2_BUCKET");
  if (!publicUrl) missing.push("R2_PUBLIC_URL");
  if (!apiToken) missing.push("R2_API_TOKEN");

  if (missing.length > 0) {
    throw new Error(
      `Configuração do Cloudflare R2 incompleta: falta ${missing.join(", ")}.`,
    );
  }

  return {
    accountId: accountId!,
    bucket: bucket!,
    publicUrl: publicUrl!.replace(/\/+$/, ""),
    apiToken: apiToken!,
  };
}

/** Monta a URL pública a partir da chave do objeto. */
export function getR2PublicUrl(objectKey: string): string {
  const base = process.env.R2_PUBLIC_URL?.trim();
  if (!base) {
    throw new Error(
      "Configuração do Cloudflare R2 incompleta: falta R2_PUBLIC_URL.",
    );
  }
  const cleanKey = objectKey.replace(/^\/+/, "");
  return `${base.replace(/\/+$/, "")}/${cleanKey}`;
}

/** Verifica se um hostname pertence ao Cloudflare R2 (pub-*.r2.dev ou R2_PUBLIC_URL configurado). */
export function isR2StorageHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== "string") return false;
  const host = hostname.toLowerCase().trim();

  const configuredR2 = process.env.R2_PUBLIC_URL?.trim();
  if (configuredR2) {
    try {
      const r2Url = new URL(configuredR2);
      if (host === r2Url.hostname.toLowerCase()) return true;
    } catch {}
  }

  if (host.endsWith(".r2.dev")) {
    return /^pub-[a-z0-9-]+\.r2\.dev$/.test(host);
  }

  return false;
}

/** Verifica se uma URL aponta para o armazenamento público do R2. */
export function isR2PhotoUrl(url: string | URL | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = typeof url === "string" ? new URL(url) : url;
    if (parsed.protocol !== "https:") return false;
    return isR2StorageHost(parsed.hostname);
  } catch {
    return false;
  }
}

/** Extrai a chave do objeto a partir de uma URL ou caminho do R2. */
export function r2KeyFromUrl(url: string | URL): string | null {
  try {
    if (typeof url === "string" && (url.includes("..") || url.includes("\\"))) {
      return null;
    }
    const parsed = typeof url === "string" ? new URL(url) : url;
    if (!isR2StorageHost(parsed.hostname)) return null;

    let pathname = parsed.pathname;
    const configuredR2 = process.env.R2_PUBLIC_URL?.trim();
    if (configuredR2) {
      try {
        const r2Url = new URL(configuredR2);
        if (parsed.hostname.toLowerCase() === r2Url.hostname.toLowerCase()) {
          const basePath = r2Url.pathname.replace(/\/+$/, "");
          if (basePath && pathname.startsWith(basePath)) {
            pathname = pathname.slice(basePath.length);
          }
        }
      } catch {}
    }

    const clean = decodeURIComponent(pathname.replace(/^\/+/, ""));
    if (!clean || clean.includes("..") || clean.includes("\\")) return null;
    return clean;
  } catch {
    return null;
  }
}

export const R2_PHOTO_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Envia um objeto para o bucket do Cloudflare R2 via API REST.
 * Endpoint: PUT https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${objectKey}
 */
export async function uploadR2Photo(
  objectKey: string,
  body: Buffer | Uint8Array | ArrayBuffer,
  contentType: string,
  fetcher: typeof fetch = fetch,
): Promise<{ url: string; key: string }> {
  const config = getR2Config();
  const cleanKey = objectKey.replace(/^\/+/, "");
  if (!cleanKey || cleanKey.includes("..") || cleanKey.includes("\\")) {
    throw new Error("Chave de objeto R2 inválida.");
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}/objects/${encodeURI(cleanKey)}`;

  const response = await fetcher(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": R2_PHOTO_CACHE_CONTROL,
    },
    body: body as BodyInit,
  });

  if (!response.ok) {
    let errBody = "";
    try {
      errBody = (await response.text()).slice(0, 200).replace(/\s+/g, " ");
    } catch {}
    throw new Error(
      `Falha no upload para R2 (${response.status}): ${errBody || response.statusText}`,
    );
  }

  const url = `${config.publicUrl}/${cleanKey}`;
  return { url, key: cleanKey };
}

/**
 * Remove um objeto do bucket do Cloudflare R2 via API REST.
 * Endpoint: DELETE https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${objectKey}
 */
export async function deleteR2Photo(
  objectKey: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const config = getR2Config();
  const cleanKey = objectKey.replace(/^\/+/, "");
  if (!cleanKey || cleanKey.includes("..") || cleanKey.includes("\\")) {
    return false;
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}/objects/${encodeURI(cleanKey)}`;

  try {
    const response = await fetcher(endpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      let errBody = "";
      try {
        errBody = (await response.text()).slice(0, 200);
      } catch {}
      console.warn(
        `[r2] Falha ao deletar objeto (${response.status}): ${errBody || response.statusText}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[r2] Erro na requisição de remoção:", error instanceof Error ? error.message : "desconhecido");
    return false;
  }
}

/** Remove múltiplos objetos do R2. */
export async function deleteR2Photos(
  objectKeys: string[],
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const validKeys = objectKeys
    .map((k) => k?.trim())
    .filter((k): k is string => Boolean(k));
  if (validKeys.length === 0) return;
  await Promise.allSettled(validKeys.map((key) => deleteR2Photo(key, fetcher)));
}

export type DownloadR2PhotoOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
  onFailureReason?: (reason: string) => void;
};

async function fetchWithTimeout(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  outerSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const onOuterAbort = () => controller.abort(outerSignal?.reason);
  if (outerSignal) {
    if (outerSignal.aborted) {
      controller.abort(outerSignal.reason);
    } else {
      outerSignal.addEventListener("abort", onOuterAbort, { once: true });
    }
  }
  const timer = setTimeout(
    () => controller.abort(new DOMException("Tempo esgotado", "TimeoutError")),
    timeoutMs,
  );
  try {
    return await fetcher(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener("abort", onOuterAbort);
  }
}

/**
 * Baixa um objeto do Cloudflare R2 (por URL ou chave).
 * Tenta primeiro via URL pública direta (rápido e com cache).
 * Se falhar, usa a API autenticada com token como reserva.
 */
export async function downloadR2Photo(
  keyOrUrl: string,
  fetcher: typeof fetch = fetch,
  options?: DownloadR2PhotoOptions,
): Promise<Buffer | null> {
  if (!keyOrUrl || typeof keyOrUrl !== "string") {
    options?.onFailureReason?.("Endereço de foto inválido");
    return null;
  }

  const isUrl = /^https?:\/\//i.test(keyOrUrl);
  const key = isUrl ? r2KeyFromUrl(keyOrUrl) : keyOrUrl.replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("\\")) {
    options?.onFailureReason?.("Endereço de foto inválido");
    return null;
  }

  const timeoutMs = Math.max(20, options?.timeoutMs ?? 10_000);
  let lastReason = "Falha ao baixar do R2";

  // 1. Tentativa via URL pública
  let publicUrl: string | null = null;
  if (isUrl && isR2PhotoUrl(keyOrUrl)) {
    publicUrl = keyOrUrl;
  } else if (process.env.R2_PUBLIC_URL?.trim()) {
    try {
      publicUrl = getR2PublicUrl(key);
    } catch {}
  }

  if (publicUrl && !options?.signal?.aborted) {
    try {
      const res = await fetchWithTimeout(
        fetcher,
        publicUrl,
        { redirect: "error" },
        timeoutMs,
        options?.signal,
      );
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
      lastReason =
        res.status === 404
          ? "Foto não encontrada"
          : `Erro HTTP ${res.status} no R2`;
    } catch (error) {
      const aborted =
        options?.signal?.aborted ||
        (error instanceof Error &&
          (error.name === "AbortError" || error.name === "TimeoutError"));
      lastReason = aborted ? "Tempo esgotado" : "Falha de conexão com o R2";
    }
  } else if (options?.signal?.aborted) {
    options?.onFailureReason?.("Tempo esgotado");
    return null;
  }

  // 2. Fallback via API autenticada do Cloudflare (se o tempo total da tentativa não esgotou)
  if (!options?.signal?.aborted && hasR2Config()) {
    try {
      const config = getR2Config();
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}/objects/${encodeURI(key)}`;
      const res = await fetchWithTimeout(
        fetcher,
        endpoint,
        {
          headers: {
            Authorization: `Bearer ${config.apiToken}`,
          },
          redirect: "error",
        },
        timeoutMs,
        options?.signal,
      );
      if (res.ok) {
        return Buffer.from(await res.arrayBuffer());
      }
      lastReason =
        res.status === 404
          ? "Foto não encontrada"
          : `Erro HTTP ${res.status} no R2`;
    } catch (error) {
      const aborted =
        options?.signal?.aborted ||
        (error instanceof Error &&
          (error.name === "AbortError" || error.name === "TimeoutError"));
      lastReason = aborted ? "Tempo esgotado" : "Falha de conexão com o R2";
    }
  }

  options?.onFailureReason?.(lastReason);
  return null;
}
