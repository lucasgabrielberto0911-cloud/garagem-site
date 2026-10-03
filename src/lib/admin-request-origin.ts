/** Usa o Host recebido: o URL interno pode ser localhost atrás do proxy. */
export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    return (
      ["http:", "https:"].includes(source.protocol) &&
      source.host === (request.headers.get("host") || new URL(request.url).host)
    );
  } catch {
    return false;
  }
}
