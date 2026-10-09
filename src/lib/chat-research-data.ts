export type ChatResearchSource = { title: string; href: string };
export type ChatResearch = {
  paragraphs: Array<{ text: string; sources: ChatResearchSource[] }>;
  comparison?: { text: string; sources: ChatResearchSource[] };
  suggestionsHtml?: string;
  unavailable?: boolean;
};

const SOURCE_HOSTS = [
  "honda.com.br",
  "hyundai.com.br",
  "hyundai.com",
  "renault.com.br",
  "fiat.com.br",
  "jeep.com.br",
  "volkswagen.com.br",
  "vw.com.br",
  "chevrolet.com.br",
  "toyota.com.br",
  "nissan.com.br",
  "mitsubishimotors.com.br",
  "ford.com.br",
  "peugeot.com.br",
  "citroen.com.br",
  "quatrorodas.abril.com.br",
  "autoesporte.globo.com",
  "motor1.com",
  "carrosnaweb.com.br",
  "icarros.com.br",
  "vertexaisearch.cloud.google.com",
];

export function safeResearchUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2500) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    if (
      !SOURCE_HOSTS.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      )
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

/** Both API and session history are untrusted. Research never supplies stock facts. */
export function readChatResearch(raw: unknown): ChatResearch | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const paragraphs: ChatResearch["paragraphs"] = [];
  if (Array.isArray(row.paragraphs))
    for (const item of row.paragraphs.slice(0, 16)) {
      if (
        !item ||
        typeof item.text !== "string" ||
        !item.text.trim() ||
        item.text.length > 1000 ||
        !Array.isArray(item.sources)
      )
        continue;
      const sources: ChatResearchSource[] = item.sources
        .slice(0, 3)
        .flatMap((source: Record<string, unknown>) => {
          if (!source || typeof source !== "object") return [];
          const href = safeResearchUrl(source.href);
          return href && typeof source.title === "string" && source.title.trim()
            ? [{ href, title: source.title.slice(0, 160) }]
            : [];
        });
      if (sources.length) paragraphs.push({ text: item.text.trim(), sources });
    }
  if (!paragraphs.length)
    return row.unavailable === true
      ? { paragraphs: [], unavailable: true }
      : undefined;
  const suggestionsHtml =
    typeof row.suggestionsHtml === "string" &&
    row.suggestionsHtml.length <= 30_000
      ? row.suggestionsHtml
      : undefined;
  const comparisonRaw = row.comparison as Record<string, unknown> | undefined;
  const comparison =
    comparisonRaw &&
    typeof comparisonRaw.text === "string" &&
    comparisonRaw.text.length <= 600 &&
    Array.isArray(comparisonRaw.sources)
      ? {
          text: comparisonRaw.text,
          sources: comparisonRaw.sources
            .flatMap((source: ChatResearchSource) => {
              const href = safeResearchUrl(source?.href);
              return href && typeof source?.title === "string"
                ? [{ href, title: source.title.slice(0, 160) }]
                : [];
            })
            .slice(0, 3),
        }
      : undefined;
  return {
    paragraphs,
    ...(suggestionsHtml ? { suggestionsHtml } : {}),
    ...(comparison?.sources.length ? { comparison } : {}),
  };
}
