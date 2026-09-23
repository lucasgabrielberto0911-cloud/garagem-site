import {
  parseVehicleDescription,
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

function FactGroup({ lines }: { lines: DescriptionFact[] }) {
  const shouts = lines.filter((line) => isShout(line.text));
  const rest = lines.filter((line) => !isShout(line.text));
  const leads = rest.filter((line) => !splitLabeled(line.text));
  const specs = rest.filter((line) => splitLabeled(line.text));

  return (
    <div className="space-y-3">
      {shouts.map((line) => (
        <p
          key={`${line.emoji}-${line.text}`}
          className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand"
        >
          <span aria-hidden="true">{line.emoji}</span>
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
              <span className="mr-2" aria-hidden="true">
                {line.emoji}
              </span>
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
                <span className="w-5 shrink-0 text-center text-sm leading-5" aria-hidden="true">
                  {line.emoji}
                </span>
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

/** Descrição do anúncio com hierarquia. Texto corrido continua um parágrafo. */
export function VehicleDescription({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const segments = parseVehicleDescription(text);
  if (segments.length === 0) return null;

  if (
    segments.length === 1 &&
    segments[0]?.kind === "prose" &&
    !text.includes("\n")
  ) {
    return (
      <p className={`text-[15px] leading-7 text-cream/90 ${className}`}>
        {segments[0].text}
      </p>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {segments.map((segment, index) => {
        if (segment.kind === "prose") {
          return (
            <p
              key={index}
              className="border-l-2 border-brand/80 pl-3 text-[15px] leading-7 text-cream/90 whitespace-pre-line"
            >
              {segment.text}
            </p>
          );
        }

        return <FactGroup key={index} lines={segment.lines} />;
      })}
    </div>
  );
}
