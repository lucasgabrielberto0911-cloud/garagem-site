import {
  parseVehicleDescription,
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
          className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-light"
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
        <ul className="divide-y divide-white/10 border border-white/10 bg-ink/40">
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
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
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
 * Segmentos que a ficha mostra. `specRows` tira as linhas rotuladas
 * ("Cor: Preta", "Câmbio: Automático") que a ficha técnica e os chips já mostram
 * com o mesmo valor; "Histórico: único dono" e afins ficam.
 */
export function visibleDescriptionSegments(
  text: string,
  summaryFacts?: DescriptionSummaryFacts,
  specRows?: { label: string; value: string }[],
): DescriptionSegment[] {
  const segments = withoutRepeatedDescriptionFacts(parseVehicleDescription(text), summaryFacts);
  if (!specRows?.length) return segments;
  const known = new Map<string, string[]>();
  for (const row of specRows) {
    const key = specKey(row.label);
    known.set(key, [...(known.get(key) ?? []), specValue(key, row.value)]);
  }
  return segments.flatMap((segment): DescriptionSegment[] => {
    if (segment.kind !== "facts") return [segment];
    const lines = segment.lines.filter((line) => {
      const labeled = splitLabeled(line.text);
      if (!labeled) return true;
      const key = specKey(labeled.label);
      const values = known.get(key);
      if (!values) return true;
      const value = specValue(key, labeled.value);
      return !values.some((known) => sameSpecValue(known, value));
    });
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
  specRows?: { label: string; value: string }[];
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
