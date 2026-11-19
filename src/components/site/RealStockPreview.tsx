import Link from "next/link";
import { VehicleImage } from "@/components/VehicleImage";
import { IconArrowRight } from "@/components/site/icons";
import { publicCardFacts } from "@/lib/public-card-facts";
import {
  coverMobileSrcSet,
  coverSrc,
  coverSrcSet,
  type VehicleCardRecord,
} from "@/lib/stock-query";
import { formatVehicleDisplay } from "@/lib/vehicle-display";

/**
 * Vitrine leve de veículos reais do estoque próprio (não consignados), usando
 * fotos 4:3 com fundo desfocado no padrão da loja. Sem JS de cliente extra.
 * Usa <div>/<article> (sem <ul> ou <nav>) para manter a semântica limpa em /links.
 */
export function RealStockPreview({
  vehicles,
  variant = "cards",
}: {
  vehicles: readonly VehicleCardRecord[];
  variant?: "compact" | "cards";
}) {
  if (vehicles.length === 0) return null;

  if (variant === "compact") {
    return (
      <div className="grid grid-cols-2 gap-3" data-real-stock-preview="compact">
        {vehicles.map((vehicle) => {
          const display = formatVehicleDisplay(vehicle);
          const card = publicCardFacts(vehicle);
          const cover = coverSrc(vehicle.photos);
          const yearFact = card.facts.find((fact) => fact.label === "Ano");

          return (
            <article
              key={vehicle.id}
              className="group overflow-hidden rounded-xl border border-white/15 bg-asphalt/95 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.75)] transition duration-200 hover:-translate-y-0.5 hover:border-brand/60"
            >
              <Link
                href={display.path}
                prefetch={false}
                className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cream"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-ink">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-hidden bg-ink bg-gradient-to-br from-white/[0.08] via-ink to-white/[0.03]"
                  >
                    <VehicleImage
                      src={cover}
                      alt=""
                      fill
                      width={320}
                      height={240}
                      sizes="(max-width: 639px) 44vw, 220px"
                      className="scale-125 object-cover blur-2xl"
                    />
                  </div>
                  <VehicleImage
                    src={cover}
                    srcSet={coverSrcSet(vehicle.photos)}
                    mobileSrcSet={coverMobileSrcSet(vehicle.photos)}
                    alt={display.titleWithYear}
                    fill
                    width={320}
                    height={240}
                    sizes="(max-width: 639px) 44vw, 220px"
                    className="object-contain transition duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between p-3">
                  <div>
                    <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-cream">
                      {card.title || display.title}
                    </h3>
                    {yearFact ? (
                      <p className="mt-1 text-xs text-muted">{yearFact.value}</p>
                    ) : null}
                  </div>
                  {card.priceLabel ? (
                    <p className="mt-2 font-display text-sm font-bold text-brand-light">
                      {card.priceLabel}
                    </p>
                  ) : null}
                </div>
              </Link>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
      data-real-stock-preview="cards"
    >
      {vehicles.map((vehicle) => {
        const display = formatVehicleDisplay(vehicle);
        const card = publicCardFacts(vehicle);
        const cover = coverSrc(vehicle.photos);

        return (
          <article
            key={vehicle.id}
            className="group overflow-hidden rounded-2xl border border-white/15 bg-ink shadow-[0_18px_40px_-16px_rgba(0,0,0,0.85)] transition duration-200 hover:-translate-y-0.5 hover:border-brand/60 hover:shadow-[0_22px_48px_-14px_rgba(0,0,0,0.92)]"
          >
            <Link
              href={display.path}
              prefetch={false}
              className="flex h-full flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cream"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-white/10 bg-asphalt">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden bg-ink bg-gradient-to-br from-white/[0.08] via-ink to-white/[0.03]"
                >
                  <VehicleImage
                    src={cover}
                    alt=""
                    fill
                    width={480}
                    height={360}
                    sizes="(max-width: 639px) 92vw, (max-width: 1023px) 46vw, 380px"
                    className="scale-125 object-cover blur-2xl"
                  />
                </div>
                <VehicleImage
                  src={cover}
                  srcSet={coverSrcSet(vehicle.photos)}
                  mobileSrcSet={coverMobileSrcSet(vehicle.photos)}
                  alt={display.titleWithYear}
                  fill
                  width={480}
                  height={360}
                  sizes="(max-width: 639px) 92vw, (max-width: 1023px) 46vw, 380px"
                  className="object-contain transition duration-300 group-hover:scale-[1.03]"
                />
              </div>

              <div className="flex flex-1 flex-col justify-between p-4 sm:p-5">
                <div>
                  <h3 className="font-display text-lg font-bold leading-snug text-cream transition group-hover:text-white">
                    {card.title || display.title}
                  </h3>
                  {card.version ? (
                    <p className="mt-1 line-clamp-1 text-sm text-muted">
                      {card.version}
                    </p>
                  ) : null}

                  {card.facts.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {card.facts.map((fact) => (
                        <span
                          key={fact.label}
                          className="rounded-md border border-white/15 bg-asphalt/80 px-2.5 py-1 text-xs font-medium text-cream/85"
                        >
                          {fact.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3.5">
                  {card.priceLabel ? (
                    <p className="font-display text-lg font-bold text-brand-light">
                      {card.priceLabel}
                    </p>
                  ) : (
                    <span className="font-display text-sm font-semibold text-cream/80">
                      Ver detalhes
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 font-display text-xs font-semibold uppercase tracking-wider text-cream/80 transition group-hover:text-brand-light">
                    Ver ficha
                    <IconArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </div>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
