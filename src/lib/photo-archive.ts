/** Nomes de arquivo do acervo. O download é sempre JPEG; a galeria no site segue WebP. */

const EXT_FROM_PATH = /\.([a-z0-9]{2,5})(?:$|[?#])/i;

export function archiveSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function extensionFromPhotoUrl(url: string) {
  const path = url.split("?")[0] ?? "";
  const match = path.match(EXT_FROM_PATH);
  const ext = match?.[1]?.toLowerCase();
  if (!ext || ext === "jpeg") return ext === "jpeg" ? "jpg" : "webp";
  if (["jpg", "png", "webp", "gif"].includes(ext)) return ext;
  return "webp";
}

export function archivePhotoFilename(input: {
  brand: string;
  model: string;
  year: number;
  index: number;
  /** A URL da galeria pode ser .webp. O arquivo baixado é sempre .jpg. */
  url?: string;
}) {
  const slug = [input.brand, input.model, String(input.year)]
    .map(archiveSlug)
    .filter(Boolean)
    .join("-");
  const pad = String(Math.max(1, input.index)).padStart(2, "0");
  return `${slug || "veiculo"}-${pad}.jpg`;
}

/** Nome seguro para Content-Disposition. Ignora pastas e força .jpg. */
export function safeJpgDownloadName(raw: string | null | undefined) {
  const base = (raw ?? "").trim().split(/[/\\]/).pop() ?? "";
  const stem = base.replace(/\.[a-z0-9]{2,5}$/i, "");
  const slug = archiveSlug(stem);
  return `${slug || "foto"}.jpg`;
}

/** JPG público da ficha. Fora de /api/veiculos para o bundle poder incluir o sharp. */
export function publicPhotoJpgPath(vehicleId: string, photoId: string) {
  return `/api/foto-jpg/${encodeURIComponent(vehicleId)}/${encodeURIComponent(photoId)}`;
}

/** JPG de uma foto já no Storage, a partir da grade do anúncio. */
export function adminStorageJpgPath(url: string, filename: string) {
  const params = new URLSearchParams({
    url,
    name: filename,
  });
  return `/api/admin/fotos/jpg?${params.toString()}`;
}

export function archiveZipFilename(input: {
  brand: string;
  model: string;
  year: number;
}) {
  const slug = [input.brand, input.model, String(input.year)]
    .map(archiveSlug)
    .filter(Boolean)
    .join("-");
  return `garagem-${slug || "veiculo"}-fotos.zip`;
}
