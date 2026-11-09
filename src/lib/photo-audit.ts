import { publicPhotoSrc } from "./public-photo-url";

export type AuditVehicle = { id: string; name: string; page: string; cover?: string; photos: string[] };
export type PhotoHead = { status: number; type: string; bytes?: number; width?: number; height?: number; error?: string };

/** HEAD apenas: nunca segue redirects nem tenta GET, inclusive após falha. */
export async function probePhotoHead(value: string, site: string, fetcher: typeof fetch = fetch): Promise<PhotoHead> {
  try {
    const target = new URL(publicPhotoSrc(new URL(value, site).href), site);
    const ownPhoto = target.origin === site && /^\/(?:api\/)?fotos\/v1\//.test(target.pathname);
    if (target.protocol !== "https:" || target.username || target.password ||
      !(ownPhoto || target.hostname.endsWith(".public.blob.vercel-storage.com"))) throw new Error("Host ou rota de foto fora do escopo público permitido");
    const response = await fetcher(target, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(15_000) });
    const number = (name: string) => {
      const raw = response.headers.get(name);
      return raw !== null && Number.isFinite(Number(raw)) && Number(raw) >= 0 ? Number(raw) : undefined;
    };
    return { status: response.status, type: response.headers.get("content-type") ?? "", bytes: number("content-length"), width: number("x-image-width"), height: number("x-image-height") };
  } catch (error) { return { status: 0, type: "", error: String(error) }; }
}

/** JSON-LD contém a galeria sem carregar imagens ou executar scripts da página. */
export function parseAuditVehicle(html: string, page: string): AuditVehicle {
  const nodes: Record<string, unknown>[] = [];
  function collect(value: unknown) {
    if (Array.isArray(value)) return value.forEach(collect);
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    nodes.push(node);
    if (node["@graph"]) collect(node["@graph"]);
  }
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    collect(JSON.parse(script[1]));
  }
  const node = nodes.find(n => ["Car", "Motorcycle", "Vehicle"].includes(String(n["@type"])));
  if (!node || typeof node.sku !== "string") throw new Error("Ficha sem JSON-LD de veículo com sku");
  const images = Array.isArray(node.image) ? node.image : node.image ? [node.image] : [];
  const photos = images.map(image => typeof image === "string" ? image : image?.url).filter((s): s is string => typeof s === "string");
  return { id: node.sku, name: String(node.name ?? node.sku), page, photos };
}

/** Ignora a variante de exibição para comparar a identidade da foto. */
export function photoIdentity(value: string, base: string): string {
  try {
    const url = new URL(value, base);
    let path = decodeURIComponent(url.pathname);
    path = path.replace(/^\/(?:api\/)?fotos\/v1\/[^/]+\//, "/veiculos/")
      .replace(/^\/storage\/v1\/(?:object|render\/image)\/public\/veiculos\//, "/veiculos/")
      .replace(/-card(?:-x\d{1,4}y\d{1,4}z\d{3}(?:-hd(?:960)?)?)?(?=\.[^.]+$)/i, "")
      .replace(/\.(?:webp|jpe?g|png|gif)$/i, "");
    return path.startsWith("/veiculos/") ? path : url.origin + path;
  } catch { return value; }
}

export function auditPhotos(vehicles: AuditVehicle[], heads: Map<string, PhotoHead>): Map<string, string[]> {
  const results = new Map<string, string[]>();
  const owners = new Map<string, Set<string>>();
  for (const vehicle of vehicles) {
    for (const photo of new Set([...vehicle.photos, ...(vehicle.cover ? [vehicle.cover] : [])])) {
      const key = photoIdentity(photo, vehicle.page);
      const ids = owners.get(key) ?? new Set<string>();
      ids.add(vehicle.id);
      owners.set(key, ids);
    }
  }
  for (const vehicle of vehicles) {
    const issues: string[] = [];
    if (!vehicle.cover || !vehicle.photos.length) issues.push("Capa ausente na listagem ou galeria vazia.");
    if (vehicle.cover && vehicle.photos[0] && photoIdentity(vehicle.cover, vehicle.page) !== photoIdentity(vehicle.photos[0], vehicle.page)) {
      issues.push(`Ordem estranha: capa da listagem diferente da primeira foto da ficha: ${vehicle.cover}`);
    }
    for (const photo of new Set([...vehicle.photos, ...(vehicle.cover ? [vehicle.cover] : [])])) {
      let url: URL;
      try { url = new URL(photo, vehicle.page); decodeURIComponent(url.pathname); }
      catch { issues.push(`URL de foto inválida: ${photo}`); continue; }
      const key = photoIdentity(photo, vehicle.page);
      if (/\.supabase\.co$/.test(url.hostname) || /^\/(?:api\/)?fotos\/v1\/[^/]+\/(?!blob\/)/.test(url.pathname)) {
        issues.push(`Referência legada ao Supabase Storage; publicar cópia local no Vercel Blob: ${photo}`);
      }
      const repeated = [...(owners.get(key) ?? [])].filter(id => id !== vehicle.id);
      if (repeated.length) issues.push(`Foto repetida entre veículos (${repeated.join(", ")}): ${photo}`);
      const folder = decodeURIComponent(url.pathname).match(/\/estoque\/([^/]+)\//)?.[1];
      // IDs de fotos também são cuids: só a pasta de veículo prova divergência.
      const otherId = folder ?? vehicles.find(v => v.id !== vehicle.id && key.includes(v.id))?.id;
      if (otherId && otherId !== vehicle.id) issues.push(`Possível foto de outro veículo: pasta/nome identifica ${otherId}, esperado ${vehicle.id}: ${photo}`);
      const head = heads.get(url.href);
      if (!head) { issues.push(`HTTP não verificado: ${photo}`); continue; }
      if (head.error || head.status !== 200) issues.push(`Foto indisponível: HTTP ${head.status || "sem resposta"}${head.error ? ` (${head.error})` : ""}: ${photo}`);
      else if (!head.type.startsWith("image/")) issues.push(`Resposta 200 não é imagem (${head.type || "sem Content-Type"}): ${photo}`);
      if (head.status === 200 && head.bytes !== undefined && head.bytes < 10_000) issues.push(`Arquivo muito pequeno (${head.bytes} bytes); suspeita de baixa qualidade, requer conferência: ${photo}`);
      const minEdge = vehicle.photos.includes(photo) ? 800 : 480;
      if (head.width && head.height && Math.max(head.width, head.height) < minEdge) issues.push(`Baixa resolução informada pelo servidor (${head.width}×${head.height}; mínimo ${minEdge}px no maior lado): ${photo}`);
    }
    results.set(vehicle.id, issues);
  }
  return results;
}
