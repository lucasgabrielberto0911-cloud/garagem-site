import { publicPhotoUpstream } from "./public-photo-url";

const noCache = { "Cache-Control": "no-store" };

/** Somente fotos públicas: sem credenciais, redirects ou cabeçalhos do Storage. */
export async function servePublicPhoto(request: Request, parts: string[], fetcher: typeof fetch = fetch) {
  const upstream = publicPhotoUpstream(parts);
  if (!upstream || new URL(request.url).search) return new Response(null, { status: 404, headers: noCache });
  try {
    const response = await fetcher(upstream, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
      headers: { Accept: "image/webp,image/jpeg,image/png,image/gif" },
    });
    const type = response.headers.get("content-type")?.split(";")[0].trim();
    if (response.status !== 200 || !type || !["image/webp", "image/jpeg", "image/png", "image/gif"].includes(type)) {
      await response.body?.cancel();
      return new Response(null, { status: response.status === 404 ? 404 : 502, headers: noCache });
    }
    // Backfill pode substituir o card no mesmo caminho. Galeria/rotação usam nomes novos.
    const thumbnail = /-card\.webp$/i.test(parts.at(-1)!);
    const headers = new Headers({
      "Content-Type": type,
      "Cache-Control": thumbnail ? "public, max-age=604800, stale-while-revalidate=86400" : "public, max-age=31536000, immutable",
      "CDN-Cache-Control": thumbnail ? "public, s-maxage=604800, stale-while-revalidate=86400" : "public, s-maxage=31536000",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of ["etag", "last-modified"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    // Streaming evita guardar arquivos grandes na memória; nenhuma transformação Vercel.
    return new Response(request.method === "HEAD" ? null : response.body, { headers });
  } catch {
    return new Response(null, { status: 502, headers: noCache });
  }
}
