import {
  parseVehicleDescription,
  splitFactLine,
  withoutRepeatedDescriptionFacts,
  type DescriptionSummaryFacts,
  type DescriptionSegment,
  type DescriptionFact,
} from "@/lib/vehicle-description";

function isShout(text: string) {
  return /novidade/i.test(text);
}

/** "Quilometragem: 106.000 km" vira rótulo + valor. Sem dois-pontos, fica frase. */
function splitLabeled(text: string) {
  const index = text.indexOf(":");
  if (index <= 0 || index > 28) return null;
  const label = text.slice(0, index).trim();
  const value = text.slice(index + 1).trim();
  if (!label || !value) return null;
  return { label, value };
}

function FactGroup({ lines, hideEmoji }: { lines: DescriptionFact[]; hideEmoji: boolean }) {
  const shouts = lines.filter((line) => isShout(line.text));
  const rest = lines.filter((line) => !isShout(line.text));
  const leads = rest.filter((line) => !splitLabeled(line.text));
  const specs = rest.filter((line) => splitLabeled(line.text));

  return (
    <div className="space-y-3">
      {shouts.map((line) => (
        <p
          key={`${line.emoji}-${line.text}`}
          className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.12em] text-brand-light"
        >
          {hideEmoji ? null : <span aria-hidden="true">{line.emoji}</span>}
          <span>{line.text}</span>
        </p>
      ))}
      {leads.length > 0 ? (
        <ul className="space-y-2">
          {leads.map((line) => (
            <li
              key={`${line.emoji}-${line.text}`}
              className="text-[15px] font-medium leading-snug text-cream"
            >
              {hideEmoji ? null : (
                <span className="mr-2" aria-hidden="true">
                  {line.emoji}
                </span>
              )}
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}
      {specs.length > 0 ? (
        <ul className="divide-y divide-white/10 border border-white/20 bg-ink/40">
          {specs.map((line) => {
            const labeled = splitLabeled(line.text);
            if (!labeled) return null;
            return (
              <li
                key={`${line.emoji}-${line.text}`}
                className="flex items-start gap-3 px-3 py-2.5"
              >
                {hideEmoji ? null : (
                  <span className="w-5 shrink-0 text-center text-sm leading-5" aria-hidden="true">
                    {line.emoji}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-cream/80">
                    {labeled.label}
                  </span>
                  <span className="mt-0.5 block text-[15px] font-medium leading-snug text-cream">
                    {labeled.value}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

const LABEL_ALIASES: Record<string, string> = {
  quilometragem: "km",
  transmissao: "cambio",
  "final da placa": "final placa",
  "final de placa": "final placa",
  placa: "final placa",
  "ano/modelo": "ano",
};

/** "Quilometragem: 106.000 km" e a linha "km: 106.000" da ficha são o mesmo dado. */
function specKey(label: string) {
  const key = normalizeSpec(label);
  return LABEL_ALIASES[key] ?? key;
}

function specValue(key: string, value: string) {
  const val = normalizeSpec(value);
  return key === "km" ? val.replace(/\s*km$/, "") : val;
}

function normalizeSpec(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

/** A linha do anúncio não diz nada além do que a ficha já mostra. Detalhe extra do anúncio fica. */
function sameSpecValue(specValue: string, lineValue: string) {
  return specValue === lineValue || specValue.includes(lineValue);
}

/**
 * Cor, ano e km ficam nos quadradinhos do topo e na ficha técnica. No
 * "Sobre o veículo" a linha rotulada some mesmo escrita de outro jeito
 * ("Quilometragem: 98 mil km", "Cor: branco perolizado").
 */
const TOP_KEYS = new Set(["km", "ano", "cor"]);

const PURE_KM =
  /^(?:com\s+|apenas\s+|so\s+)?(?:km\s*:?\s*)?\d[\d.,\s]*(?:mil\s*)?(?:km|quilometros)(?:\s*rodados?)?(?:\s*originais?)?$/;
const PURE_YEAR = /^(?:(?:ano|modelo)(?:\s*\/\s*modelo)?\s*:?\s*)?(?:19|20)\d{2}(?:\s*\/\s*(?:19|20)\d{2})?$/;

type SpecContext = { known: Map<string, string[]> };

/** Linha que só repete cor, ano ou km ("🛣️ 98.000 km", "2012/2013", "Branco"). */
function isBareTopFact(text: string, ctx: SpecContext) {
  const line = normalizeSpec(splitFactLine(text)?.text ?? text).replace(/[.!;,]+$/, "").trim();
  if (!line || line.length > 40) return false;
  if (ctx.known.has("km") && PURE_KM.test(line)) return true;
  if (ctx.known.has("ano") && PURE_YEAR.test(line)) return true;
  const colors = ctx.known.get("cor");
  if (colors?.length) {
    const bare = line.replace(/^cor\s*:?\s*/, "");
    if (colors.includes(bare)) return true;
    if (/^cor\s/.test(line) && colors.some((color) => bare.startsWith(color))) return true;
  }
  return false;
}

/** Linha rotulada ("Cor: Prata") que a ficha já mostra. */
function isRepeatedLabeled(text: string, ctx: SpecContext) {
  const labeled = splitLabeled(text);
  if (!labeled) return false;
  const key = specKey(labeled.label);
  const values = ctx.known.get(key);
  if (!values) return false;
  if (TOP_KEYS.has(key)) return true;
  const value = specValue(key, labeled.value);
  return values.some((known) => sameSpecValue(known, value));
}

function repeatsSpec(text: string, ctx: SpecContext) {
  return isRepeatedLabeled(text, ctx) || isBareTopFact(text, ctx);
}

/**
 * Segmentos que a ficha mostra. `specRows` tira as linhas rotuladas
 * ("Cor: Preta", "Câmbio: Automático") que a ficha técnica e os quadradinhos
 * já mostram com o mesmo valor, e qualquer linha que só repita cor, ano ou km.
 * "Histórico: único dono", ressalvas e o texto do anúncio ficam.
 */
export function visibleDescriptionSegments(
  text: string,
  summaryFacts?: DescriptionSummaryFacts,
  specRows?: { label: string; value: string; empty?: boolean }[],
): DescriptionSegment[] {
  const segments = withoutRepeatedDescriptionFacts(parseVehicleDescription(text), summaryFacts);
  if (!specRows?.length) return segments;
  const known = new Map<string, string[]>();
  for (const row of specRows) {
    if (row.empty) continue;
    const key = specKey(row.label);
    known.set(key, [...(known.get(key) ?? []), specValue(key, row.value)]);
  }
  const ctx: SpecContext = { known };
  return segments.flatMap((segment): DescriptionSegment[] => {
    if (segment.kind === "prose") {
      // Parágrafo sem emoji também pode ser uma lista "Km: ... / Ano: ...".
      const lines = segment.text.split("\n");
      const kept = lines.filter((line) => !repeatsSpec(line.trim(), ctx));
      if (kept.length === lines.length) return [segment];
      const rest = kept.join("\n").trim();
      return rest ? [{ kind: "prose", text: rest }] : [];
    }
    const lines = segment.lines.filter((line) => !repeatsSpec(line.text, ctx));
    return lines.length > 0 ? [{ kind: "facts", lines }] : [];
  });
}

/** Descrição do anúncio com hierarquia. Texto corrido continua um parágrafo. */
export function VehicleDescription({
  text,
  className = "",
  summaryFacts,
  specRows,
  hideEmoji = false,
}: {
  text: string;
  className?: string;
  summaryFacts?: DescriptionSummaryFacts;
  specRows?: { label: string; value: string; empty?: boolean }[];
  /** Celular: sem emoji nas linhas. Desktop mantém como o anúncio foi escrito. */
  hideEmoji?: boolean;
}) {
  const segments = visibleDescriptionSegments(text, summaryFacts, specRows);
  if (segments.length === 0) return null;

  if (
    segments.length === 1 &&
    segments[0]?.kind === "prose" &&
    !text.includes("\n")
  ) {
    return (
      <p className={`border-l-2 border-brand/80 pl-3 font-body text-[15px] leading-7 text-cream/90 ${className}`}>
        {segments[0].text}
      </p>
    );
  }

  return (
    <div className={`space-y-4 border-l-2 border-brand/80 pl-3 font-body ${className}`}>
      {segments.map((segment, index) => {
        if (segment.kind === "prose") {
          return (
            <p
              key={index}
              className="text-[15px] leading-7 text-cream/90 whitespace-pre-line"
            >
              {segment.text}
            </p>
          );
        }

        return <FactGroup key={index} lines={segment.lines} hideEmoji={hideEmoji} />;
      })}
    </div>
  );
}
