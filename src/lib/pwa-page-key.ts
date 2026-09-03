/** Query params de campanha — não entram na chave de cache do PWA. */
const TRACKING_PARAM =
  /^(utm_|fbclid|gclid|gbraid|wbraid|msclkid|_vercel|ttclid)/i;

/**
 * Normaliza a URL da navegação para o Cache Storage.
 * `/?utm_source=pwa` e `/` passam a ser a mesma entrada — senão o app
 * instalado nunca acerta o HTML já visitado no navegador.
 */
export function pageCacheKeyFromUrl(raw: string, origin = "https://www.suagaragem.net") {
  const url = new URL(raw, origin);
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(name)) url.searchParams.delete(name);
  }
  const search = url.searchParams.toString();
  return search ? `${url.pathname}?${search}` : url.pathname;
}
