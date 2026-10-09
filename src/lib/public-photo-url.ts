/** URLs de apresentação. Banco, uploads e admin mantêm as URLs do Storage. */
import { galleryPreviewObjectPath } from "./gallery-preview-path";
export const PHOTO_STORAGE_ORIGIN = "https://vesmqhyxautgtvgccweo.supabase.co";
export const PUBLIC_PHOTO_PREFIX = "/fotos/v1/";
const OBJECT_PREFIX = "/storage/v1/object/public/veiculos/";
const RENDER_PREFIX = "/storage/v1/render/image/public/veiculos/";

/** Somente os recortes já usados no site, sem novas transformações. */
export const PUBLIC_PHOTO_VARIANTS: Record<string, string> = {
  "480x360-cover-q65": "width=480&height=360&resize=cover&quality=65&format=webp",
  "480x360-cover-q74": "width=480&height=360&resize=cover&quality=74&format=webp",
  "720x540-cover-q75": "width=720&height=540&resize=cover&quality=75&format=webp",
  "960x720-cover-q75": "width=960&height=720&resize=cover&quality=75&format=webp",
  "240x150-cover-q65": "width=240&height=150&resize=cover&quality=65&format=webp",
  "800-contain-q80": "width=800&resize=contain&quality=80&format=webp",
  "1200-contain-q80": "width=1200&resize=contain&quality=80&format=webp",
};

export function validPublicPhotoKey(parts: string[]) {
  return parts.length > 0 && parts.length <= 12 && parts.join("/").length <= 1024 &&
    parts.every(part => /^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(part) && !part.includes("..")) &&
    /\.(?:webp|jpe?g|png|gif)$/i.test(parts.at(-1)!);
}

export function publicPhotoSrc(value: string): string {
  try {
    const url = new URL(value);
    if (url.origin !== PHOTO_STORAGE_ORIGIN || url.username || url.password) return value;
    const rendered = url.pathname.startsWith(RENDER_PREFIX);
    const prefix = rendered ? RENDER_PREFIX : OBJECT_PREFIX;
    if (!url.pathname.startsWith(prefix)) return value;
    const parts = url.pathname.slice(prefix.length).split("/").map(decodeURIComponent);
    if (!validPublicPhotoKey(parts)) return value;
    let variant = "original";
    if (rendered) {
      const entries = [...url.searchParams.entries()];
      const match = Object.entries(PUBLIC_PHOTO_VARIANTS).find(([, query]) => {
        const expected = new URLSearchParams(query);
        return entries.length === [...expected].length && new Set(entries.map(([k]) => k)).size === entries.length && entries.every(([k, v]) => expected.get(k) === v);
      });
      if (!match) return value;
      variant = match[0];
    } else if (url.search) return value;
    return `${PUBLIC_PHOTO_PREFIX}${variant}/${parts.join("/")}`;
  } catch { return value; }
}

export function publicPhotoSrcSet(value?: string) {
  return value?.split(",").map(item => {
    const [url, ...descriptor] = item.trim().split(/\s+/);
    return [publicPhotoSrc(url), ...descriptor].join(" ");
  }).join(", ");
}

/** Recuperação da galeria permanece no mesmo domínio. */
export function publicPhotoOriginal(value: string): string | null {
  try {
    const url = new URL(value, "https://www.suagaragem.net");
    if (!url.pathname.startsWith(PUBLIC_PHOTO_PREFIX)) return null;
    const parts = url.pathname.slice(PUBLIC_PHOTO_PREFIX.length).split("/");
    const variant = parts.shift()!;
    if (variant === "original" || !Object.hasOwn(PUBLIC_PHOTO_VARIANTS, variant) || !validPublicPhotoKey(parts)) return null;
    const path = `${PUBLIC_PHOTO_PREFIX}original/${parts.join("/")}`;
    return value.startsWith("/") ? path : url.origin + path;
  } catch { return null; }
}

export function publicPhotoUpstream(parts: string[]) {
  const [version, variant, ...key] = parts;
  if (version !== "v1" || !validPublicPhotoKey(key)) return null;
  if (variant === "original") return PHOTO_STORAGE_ORIGIN + OBJECT_PREFIX + key.join("/");
  if (!Object.hasOwn(PUBLIC_PHOTO_VARIANTS, variant)) return null;
  const preview = variant === "800-contain-q80" ? galleryPreviewObjectPath(key.join("/")) : null;
  if (preview) return PHOTO_STORAGE_ORIGIN + OBJECT_PREFIX + preview;
  return PHOTO_STORAGE_ORIGIN + RENDER_PREFIX + key.join("/") + "?" + PUBLIC_PHOTO_VARIANTS[variant];
}

/** Só usado se um preview versionado estiver indisponível. URLs antigas não fazem tentativa extra. */
export function publicPhotoPreviewFallback(parts: string[]) {
  const [version, variant, ...key] = parts;
  if (version !== "v1" || variant !== "800-contain-q80" || !validPublicPhotoKey(key) || !galleryPreviewObjectPath(key.join("/"))) return null;
  return PHOTO_STORAGE_ORIGIN + RENDER_PREFIX + key.join("/") + "?" + PUBLIC_PHOTO_VARIANTS[variant];
}
