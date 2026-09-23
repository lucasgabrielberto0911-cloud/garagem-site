import { parseVehicleDescription } from "@/lib/vehicle-description";

function isShout(text: string) {
  return /novidade/i.test(text);
}

/** Descrição do anúncio com respiro. Texto corrido continua um parágrafo. */
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
    return <p className={`leading-relaxed ${className}`}>{segments[0].text}</p>;
  }

  return (
    <div className={`space-y-3.5 ${className}`}>
      {segments.map((segment, index) => {
        if (segment.kind === "prose") {
          return (
            <p key={index} className="whitespace-pre-line leading-relaxed text-cream/85">
              {segment.text}
            </p>
          );
        }

        return (
          <ul key={index} className="space-y-2">
            {segment.lines.map((line) => (
              <li key={`${line.emoji}-${line.text}`} className="flex items-start gap-2.5">
                <span className="w-5 shrink-0 text-center text-base leading-5" aria-hidden="true">
                  {line.emoji}
                </span>
                <span
                  className={
                    isShout(line.text)
                      ? "font-display text-[13px] font-semibold uppercase tracking-wide text-brand"
                      : "leading-snug text-cream/95"
                  }
                >
                  {line.text}
                </span>
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
