import { publicPhotoPreviewFallback, publicPhotoUpstream } from "./public-photo-url";

const noCache = { "Cache-Control": "no-store" };

/** Somente fotos públicas: sem credenciais, redirects ou cabeçalhos do Storage. */
export async function servePublicPhoto(request: Request, parts: string[], fetcher: typeof fetch = fetch) {
  const upstream = publicPhotoUpstream(parts);
  if (!upstream || new URL(request.url).search) return new Response(null, { status: 404, headers: noCache });
  try {
    // Validadores são públicos; cookies e autorização nunca chegam ao Storage.
    const upstreamHeaders: Record<string, string> = { Accept: "image/webp,image/jpeg,image/png,image/gif" };
    for (const name of ["if-none-match", "if-modified-since"]) {
      const value = request.headers.get(name);
      if (value) upstreamHeaders[name] = value;
    }
    const options: RequestInit = {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
      headers: upstreamHeaders,
    };
    let response = await fetcher(upstream, options);
    const fallback = publicPhotoPreviewFallback(parts);
    if ([400, 404].includes(response.status) && fallback) {
      await response.body?.cancel();
      response = await fetcher(fallback, options);
    }
    // Backfill pode substituir o card no mesmo caminho (upsert), então 30 dias e sem immutable.
    // Galeria/rotação usam nomes novos.
    const thumbnail = /-card\.webp$/i.test(parts.at(-1)!);
    const headers = new Headers({
      "Cache-Control": thumbnail ? "public, max-age=2592000, stale-while-revalidate=86400" : "public, max-age=31536000, immutable",
      "CDN-Cache-Control": thumbnail ? "public, s-maxage=2592000, stale-while-revalidate=86400" : "public, s-maxage=31536000",
      "X-Content-Type-Options": "nosniff",
    });
    for (const name of ["etag", "last-modified"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    // Storage pode confirmar a versão sem reenviar os bytes da imagem.
    if (response.status === 304 && (upstreamHeaders["if-none-match"] || upstreamHeaders["if-modified-since"])) {
      await response.body?.cancel();
      return new Response(null, { status: 304, headers });
    }
    const type = response.headers.get("content-type")?.split(";")[0].trim();
    if (response.status !== 200 || !type || !["image/webp", "image/jpeg", "image/png", "image/gif"].includes(type)) {
      await response.body?.cancel();
      return new Response(null, { status: response.status === 404 ? 404 : 502, headers: noCache });
    }
    headers.set("Content-Type", type);
    // Streaming evita guardar arquivos grandes na memória; nenhuma transformação Vercel.
    return new Response(request.method === "HEAD" ? null : response.body, { headers });
  } catch {
    return new Response(null, { status: 502, headers: noCache });
  }
}
