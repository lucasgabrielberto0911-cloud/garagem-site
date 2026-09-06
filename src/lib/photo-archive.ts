/** Nomes de arquivo do acervo de fotos no admin. */

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
  url: string;
}) {
  const slug = [input.brand, input.model, String(input.year)]
    .map(archiveSlug)
    .filter(Boolean)
    .join("-");
  const pad = String(Math.max(1, input.index)).padStart(2, "0");
  const ext = extensionFromPhotoUrl(input.url);
  return `${slug || "veiculo"}-${pad}.${ext}`;
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
