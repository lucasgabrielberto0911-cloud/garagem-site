import { isR2StorageHost } from "./r2-photos";

/** Browser-safe file references; privileged Storage access stays on the server. */
export const VEHICLE_PHOTOS_BUCKET = "veiculos";
export const VEHICLE_DOCS_BUCKET = "documentos";
export const PRIVATE_FILE_PREFIX = "private://documentos/";

export type StoredFileRef =
  | { kind: "private"; bucket: typeof VEHICLE_DOCS_BUCKET; path: string }
  | {
      kind: "public";
      bucket: typeof VEHICLE_PHOTOS_BUCKET;
      path: string;
      url: string;
    };

function publicMarker(bucket: string) {
  return `/storage/v1/object/public/${bucket}/`;
}

export function isAllowedStorageHost(
  hostname: string,
  port?: string,
  protocol?: string,
): boolean {
  const host = hostname.toLowerCase().trim();

  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (configured) {
    try {
      const configuredUrl = new URL(configured);
      const configuredHost = configuredUrl.hostname.toLowerCase();
      const configuredPort = configuredUrl.port;
      const configuredProtocol = configuredUrl.protocol;

      // Se NEXT_PUBLIC_SUPABASE_URL estiver explicitamente configurada (inclusive servidor mock em teste)
      if (
        host === configuredHost &&
        (port ?? "") === configuredPort &&
        (!protocol || protocol === configuredProtocol)
      ) {
        return true;
      }
    } catch {}
  }

  const configuredR2 = process.env.R2_PUBLIC_URL?.trim();
  if (configuredR2) {
    try {
      const r2Url = new URL(configuredR2);
      const r2Host = r2Url.hostname.toLowerCase();
      const r2Port = r2Url.port;
      const r2Protocol = r2Url.protocol;

      const portMatch =
        (port ?? "") === r2Port ||
        (!r2Port && (!port || port === "443"));

      if (
        host === r2Host &&
        portMatch &&
        (!protocol || protocol === r2Protocol)
      ) {
        return true;
      }
    } catch {}
  }

  // Rejeita loopback e IPs especiais/privados
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "169.254.169.254"
  ) {
    return false;
  }

  // Se não for a URL configurada, protocolo DEVE ser https e sem porta arbitrária
  if (protocol && protocol !== "https:") {
    return false;
  }
  if (port && port !== "443") {
    return false;
  }

  // Permite subdomínios supabase.co válidos (ex: x.supabase.co em testes/staging)
  if (host === "supabase.co" || host.endsWith(".supabase.co")) {
    return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.supabase\.co$/.test(host);
  }

  // Permite subdomínios pub-*.r2.dev válidos (Cloudflare R2 public buckets)
  if (host.endsWith(".r2.dev")) {
    return /^pub-[a-z0-9-]+\.r2\.dev$/.test(host);
  }

  return false;
}

/** Extrai o path do objeto a partir da URL pública do Storage ou Cloudflare R2. */
export function storagePathFromPublicUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048 || trimmed.includes("..")) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) return null;
    if (!isAllowedStorageHost(parsed.hostname, parsed.port, parsed.protocol))
      return null;

    let rawPath: string | null = null;
    const marker = publicMarker(VEHICLE_PHOTOS_BUCKET);
    const index = parsed.pathname.indexOf(marker);
    if (index !== -1) {
      rawPath = parsed.pathname.slice(index + marker.length);
    } else if (isR2StorageHost(parsed.hostname)) {
      const configuredR2 = process.env.R2_PUBLIC_URL?.trim();
      let basePath = "";
      if (configuredR2) {
        try {
          const r2Url = new URL(configuredR2);
          if (parsed.hostname.toLowerCase() === r2Url.hostname.toLowerCase()) {
            basePath = r2Url.pathname.replace(/\/+$/, "");
          }
        } catch {}
      }
      if (basePath && parsed.pathname.startsWith(basePath)) {
        rawPath = parsed.pathname.slice(basePath.length).replace(/^\/+/, "");
      } else {
        rawPath = parsed.pathname.replace(/^\/+/, "");
      }
    } else {
      return null;
    }

    if (!rawPath) return null;
    const decoded = decodeURIComponent(rawPath);
    if (
      !decoded ||
      decoded.startsWith("/") ||
      decoded.includes("\\") ||
      decoded.includes("..")
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function parseStoredFileRef(
  value: string | null | undefined,
): StoredFileRef | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  if (raw.startsWith(PRIVATE_FILE_PREFIX)) {
    const path = raw.slice(PRIVATE_FILE_PREFIX.length).replace(/^\/+/, "");
    if (!path || path.includes("..") || path.includes("\\")) return null;
    return { kind: "private", bucket: VEHICLE_DOCS_BUCKET, path };
  }

  const path = storagePathFromPublicUrl(raw);
  if (!path) return null;
  return { kind: "public", bucket: VEHICLE_PHOTOS_BUCKET, path, url: raw };
}

export function privateFileRef(path: string) {
  return `${PRIVATE_FILE_PREFIX}${path.replace(/^\/+/, "")}`;
}

export function isInternalAdminFileUrl(url: string) {
  return parseStoredFileRef(url) != null;
}

export function adminFileViewHref(stored: string) {
  return `/api/admin/files/view?ref=${encodeURIComponent(stored)}`;
}
