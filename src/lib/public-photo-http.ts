import sharp from "sharp";
import { e2ePhotoFixture } from "./e2e-photo-fixture";
import { publicPhotoPreviewFallback, publicPhotoUpstream, VEHICLE_PHOTO_VARIANT } from "./public-photo-url";

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
    const fixture = await e2ePhotoFixture();
    let response = fixture
      ? new Response(request.method === "HEAD" ? null : new Uint8Array(fixture), { headers: { "Content-Type": "image/png" } })
      : await fetcher(upstream, options);
    const fallback = publicPhotoPreviewFallback(parts);
    if (!fixture && [400, 404].includes(response.status) && fallback) {
      await response.body?.cancel();
      response = await fetcher(fallback, options);
    }
    // Cards legados podem ser regravados pelo backfill no mesmo caminho.
    const cacheControl = /-card(?:[.-]|$)/i.test(parts.at(-1) ?? "")
      ? "public, max-age=2592000, s-maxage=2592000"
      : "public, max-age=31536000, s-maxage=31536000, immutable";
    const headers = new Headers({
      "Cache-Control": cacheControl,
      "Vercel-CDN-Cache-Control": cacheControl,
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
    if (parts[1] === VEHICLE_PHOTO_VARIANT) {
      headers.set("Content-Type", "image/webp");
      if (request.method === "HEAD") return new Response(null, { headers });
      if (!response.body) return new Response(null, { status: 502, headers: noCache });
      // Limite também para respostas chunked, antes de decodificar a imagem.
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 15 * 1024 * 1024) {
          await reader.cancel();
          return new Response(null, { status: 502, headers: noCache });
        }
        chunks.push(value);
      }
      const bytes = await sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000 })
        .rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 }).toBuffer();
      return new Response(new Uint8Array(bytes), { headers });
    }
    headers.set("Content-Type", type);
    // Streaming evita guardar arquivos grandes na memória; nenhuma transformação Vercel.
    return new Response(request.method === "HEAD" ? null : response.body, { headers });
  } catch {
    return new Response(null, { status: 502, headers: noCache });
  }
}
