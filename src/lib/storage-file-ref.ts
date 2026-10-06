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

/** Extrai o path do objeto a partir da URL pública do Storage. */
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = publicMarker(VEHICLE_PHOTOS_BUCKET);
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

export function parseStoredFileRef(
  value: string | null | undefined,
): StoredFileRef | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  if (raw.startsWith(PRIVATE_FILE_PREFIX)) {
    const path = raw.slice(PRIVATE_FILE_PREFIX.length).replace(/^\/+/, "");
    if (!path || path.includes("..")) return null;
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
