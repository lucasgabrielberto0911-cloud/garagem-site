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

const COLS = ["grid-cols-1", "grid-cols-1", "grid-cols-2", "grid-cols-3"] as const;

/**
 * Cor, ano e KM em quadradinhos, logo abaixo do preço (desktop e celular).
 * `onInk`: o card do desktop é `bg-ink`, então o quadradinho fica mais escuro.
 */
export function VehicleKeyFacts({
  facts,
  className = "",
  onInk = false,
}: {
  facts: readonly VehicleKeyFact[];
  className?: string;
  onInk?: boolean;
}) {
  if (facts.length === 0) return null;
  return (
    <dl
      data-key-facts=""
      className={`grid gap-1.5 ${COLS[Math.min(facts.length, 3)]} ${className}`}
    >
      {facts.map((fact) => (
        <div
          key={fact.label}
          data-key-fact={fact.label}
          className={`min-w-0 border border-white/10 px-2.5 py-2 ${onInk ? "bg-asphalt/70" : "bg-ink"}`}
        >
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {fact.label}
          </dt>
          <dd className="mt-0.5 font-display text-sm font-semibold leading-tight text-cream [overflow-wrap:break-word] sm:text-[15px]">
            {breakAfterSlash(fact.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
