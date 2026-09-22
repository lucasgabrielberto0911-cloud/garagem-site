import { isVehicleFichaPath } from "@/lib/site";

/** Query params de campanha — não entram na chave de cache do PWA. */
const TRACKING_PARAM =
  /^(utm_|fbclid|gclid|gbraid|wbraid|msclkid|_vercel|ttclid)/i;

/** Espelhado em `public/sw.js` (`normalizePathname`). */
export function normalizePathname(pathname: string) {
  const path = (pathname || "/").split("?")[0] || "/";
  if (path === "/") return "/";
  return path.replace(/\/+$/, "") || "/";
}

/** Home, lista do estoque, favoritos e a página offline — HTML precacheado. */
export function isPrecachedShellPath(pathname: string) {
  const path = normalizePathname(pathname);
  return (
    path === "/" ||
    path === "/estoque" ||
    path === "/favoritos" ||
    path === "/offline"
  );
}

/** Lista do estoque (não a ficha). Rede com prazo curto, depois o cache. */
export function isStockListingPath(pathname: string) {
  return normalizePathname(pathname) === "/estoque";
}

/** Ficha do veículo: sempre rede. Sem cache de preço/status. */
export function isNetworkOnlyPagePath(pathname: string) {
  return isVehicleFichaPath(pathname);
}

/**
 * Normaliza a URL da navegação para o Cache Storage.
 * `/?utm_source=pwa` e `/` passam a ser a mesma entrada — senão o app
 * instalado nunca acerta o HTML já visitado no navegador.
 * `_rsc` é parâmetro interno do Next e não diferencia o HTML.
 */
export function pageCacheKeyFromUrl(raw: string, origin = "https://www.suagaragem.net") {
  const url = new URL(raw, origin);
  url.searchParams.delete("_rsc");
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(name)) url.searchParams.delete(name);
  }
  const pathname = normalizePathname(url.pathname);
  const search = url.searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}
