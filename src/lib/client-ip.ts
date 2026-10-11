/**
 * IP do visitante para limites de uso. Na Vercel o primeiro valor de
 * x-forwarded-for é definido pela borda (não pelo cliente). Devolve null
 * quando não há IP confiável, para não juntar todo mundo no mesmo balde.
 */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "";
  return ip && ip.length <= 64 ? ip : null;
}
