import { Fragment } from "react";
import type { VehicleKeyFact } from "@/lib/vehicle-specs";

/** "2012/2013" quebra depois da barra em 320 px, nunca no meio do ano. */
function breakAfterSlash(value: string) {
  const parts = value.split("/");
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 ? (
        <>
          /<wbr />
        </>
      ) : null}
    </Fragment>
  ));
}

const WIDE_COLS = ["", "xl:grid-cols-1", "xl:grid-cols-2", "xl:grid-cols-3", "xl:grid-cols-4"] as const;

/**
 * Ano, KM, câmbio e combustível em quadradinhos, logo abaixo do preço:
 * 2×2 no celular e lado a lado no computador largo. A cor fica numa linha só dela.
 * `onInk`: o card do desktop é `bg-ink`, então o quadradinho fica mais escuro.
 */
export function VehicleKeyFacts({
  facts,
  color,
  className = "",
  onInk = false,
}: {
  facts: readonly VehicleKeyFact[];
  color?: string | null;
  className?: string;
  onInk?: boolean;
}) {
  if (facts.length === 0 && !color) return null;
  const surface = `border border-white/20 px-2.5 ${onInk ? "bg-asphalt/80" : "bg-ink"}`;
  return (
    <dl
      data-key-facts=""
      className={`grid grid-cols-2 gap-1.5 ${WIDE_COLS[Math.min(facts.length, 4)]} ${className}`}
    >
      {facts.map((fact, index) => (
        <div
          key={fact.label}
          data-key-fact={fact.label}
          className={`min-w-0 py-2 ${surface} ${
            index === facts.length - 1 && facts.length % 2 === 1 ? "col-span-2 xl:col-span-1" : ""
          }`}
        >
          <dt className="text-sm font-medium text-cream/75">{fact.label}</dt>
          <dd
            className={`mt-0.5 font-display text-sm font-semibold leading-tight text-cream sm:text-[15px] ${
              fact.label === "Ano"
                ? "whitespace-nowrap"
                : "[overflow-wrap:break-word]"
            }`}
          >
            {breakAfterSlash(fact.value)}
            {fact.label === "KM" && !/\bkm\b/i.test(fact.value) ? (
              <span className="font-medium text-cream/75"> km</span>
            ) : null}
          </dd>
        </div>
      ))}
      {color ? (
        <div data-key-fact="Cor" className={`col-span-full flex min-w-0 items-baseline gap-2 py-1.5 ${surface}`}>
          <dt className="shrink-0 text-sm font-medium text-cream/75">Cor</dt>
          <dd className="min-w-0 font-display text-sm font-semibold leading-snug text-cream [overflow-wrap:break-word]">
            {color}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
