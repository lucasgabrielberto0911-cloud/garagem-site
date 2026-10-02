import Link from "next/link";
import { IconArrowRight } from "@/components/site/icons";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import type { VehicleCardData } from "@/components/site/VehicleCard";
import { WhatsAppButton } from "@/components/site/ui";

/**
 * Outros disponíveis no fim da ficha.
 * O card usa a foto, o nome, o ano, a km e o preço que o estoque já mostra,
 * e abre a ficha. O WhatsApp do card fica de fora — a página já tem o da loja.
 */
export function SimilarVehicles({
  vehicles,
  title,
  description,
  stockHref,
  whatsapp,
}: {
  vehicles: VehicleCardData[];
  title: string;
  description: string;
  stockHref: string;
  whatsapp?: {
    message: string;
    trackingLabel: string;
    content: string;
    vehicleId: string;
    slug: string;
  };
}) {
  if (vehicles.length === 0) return null;

  return (
    <section
      id="mesma-faixa"
      data-similar-vehicles=""
      className="mt-10 scroll-mt-24 border-t border-white/5 pt-8 sm:mt-12 sm:pt-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-cream sm:text-xl">
            {title}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{description}</p>
        </div>
        <Link
          href={stockHref}
          className="inline-flex min-h-[44px] items-center gap-1.5 font-display text-xs font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
        >
          Ver a faixa no estoque
          <IconArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-5">
        <VehicleGrid vehicles={vehicles} showWhatsApp={false} />
      </div>
      {whatsapp ? (
        <div className="mt-5">
          <WhatsAppButton
            trackingLabel={whatsapp.trackingLabel}
            campaign="ficha"
            content={whatsapp.content}
            vehicleId={whatsapp.vehicleId}
            slug={whatsapp.slug}
            message={whatsapp.message}
            variant="outline"
            className="w-full sm:w-auto"
          >
            Pedir outros nesta faixa
          </WhatsAppButton>
        </div>
      ) : null}
    </section>
  );
}
