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
  hideYearBelowLg = false,
  specAnchor = false,
}: {
  facts: readonly VehicleKeyFact[];
  color?: string | null;
  className?: string;
  onInk?: boolean | "lg";
  /** Na ficha unificada o ano já aparece ao lado do título abaixo de `lg`. */
  hideYearBelowLg?: boolean;
  /** Quando a ficha mobile não tem especificações extras, a âncora aponta para estes fatos. */
  specAnchor?: boolean;
}) {
  if (facts.length === 0 && !color) return null;
  const surfaceBg =
    onInk === "lg"
      ? "rounded-xl border border-white/12 bg-asphalt/70 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:rounded-none lg:border-white/20 lg:bg-asphalt/80 lg:px-2.5 lg:shadow-none"
      : onInk
        ? "border border-white/20 bg-asphalt/80 px-2.5"
        : "rounded-xl border border-white/12 bg-asphalt/70 px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:rounded-none lg:border-white/20 lg:bg-ink lg:px-2.5 lg:shadow-none";
  const surface = surfaceBg;
  const hasHiddenYear = hideYearBelowLg && facts.some((fact) => fact.label === "Ano");
  const mobileFactCount = hasHiddenYear
    ? facts.filter((fact) => fact.label !== "Ano").length
    : facts.length;
  const colorFillsMobileCell = Boolean(
    hasHiddenYear && color && mobileFactCount % 2 === 1,
  );

  return (
    <dl
      data-key-facts=""
      data-ficha-section={specAnchor ? "especificacoes" : undefined}
      className={`grid grid-cols-2 gap-2 lg:gap-1.5 ${WIDE_COLS[Math.min(facts.length, 4)]}${specAnchor ? " ficha-jump-target" : ""} ${className}`}
    >
      {facts.map((fact, index) => {
        const isHiddenYearOnMobile = hasHiddenYear && fact.label === "Ano";
        const isLastOddDesktop = index === facts.length - 1 && facts.length % 2 === 1;
        const isLastOddMobile =
          index === facts.length - 1 &&
          !colorFillsMobileCell &&
          mobileFactCount % 2 === 1;
        const spanClass =
          isLastOddDesktop && isLastOddMobile
            ? "col-span-2 xl:col-span-1"
            : isLastOddDesktop
              ? "lg:col-span-2 xl:col-span-1"
              : isLastOddMobile
                ? "col-span-2 lg:col-span-1"
                : "";
        return (
          <div
            key={fact.label}
            data-key-fact={isHiddenYearOnMobile ? undefined : fact.label}
            className={`min-w-0 py-2.5 lg:py-2 ${surface} ${isHiddenYearOnMobile ? "hidden lg:block " : ""}${spanClass}`.trim()}
          >
            <dt className="text-sm font-medium text-cream/75">{fact.label}</dt>
            <dd
              className={`mt-0.5 font-display text-[15px] font-bold leading-tight text-cream lg:text-sm lg:font-semibold sm:text-[15px] ${
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
        );
      })}
      {color ? (
        <div
          data-key-fact="Cor"
          className={
            colorFillsMobileCell
              ? `min-w-0 py-2.5 lg:py-1.5 ${surface} lg:col-span-full lg:flex lg:items-baseline lg:gap-2`
              : `col-span-full flex min-w-0 items-baseline gap-2 py-2 lg:py-1.5 ${surface}`
          }
        >
          <dt className="shrink-0 text-sm font-medium text-cream/75">Cor</dt>
          <dd
            className={
              colorFillsMobileCell
                ? "mt-0.5 min-w-0 font-display text-[15px] font-bold leading-tight text-cream [overflow-wrap:break-word] sm:text-[15px] lg:mt-0 lg:text-sm lg:font-semibold lg:leading-snug"
                : "min-w-0 font-display text-[15px] font-bold leading-snug text-cream [overflow-wrap:break-word] lg:text-sm lg:font-semibold"
            }
          >
            {color}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
