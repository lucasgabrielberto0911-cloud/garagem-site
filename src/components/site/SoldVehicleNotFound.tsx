"use client";

import { usePathname } from "next/navigation";
import { ButtonLink, Container, WhatsAppButton } from "@/components/site/ui";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import type { VehicleCardData } from "@/components/site/VehicleCard";
import { formatCustomerVehicleWhatsAppText } from "@/lib/site";
import {
  parseSoldVehicleSlug,
  selectSimilarVehiclesForSoldSlug,
} from "@/lib/sold-slug-fallback";

export function SoldVehicleNotFound({
  vehicles,
}: {
  vehicles: VehicleCardData[];
}) {
  const pathname = usePathname() ?? "";
  const parsed = parseSoldVehicleSlug(pathname);
  const similarVehicles = selectSimilarVehiclesForSoldSlug(vehicles, parsed, 4);
  const whatsappMessage = formatCustomerVehicleWhatsAppText({
    label: parsed.label,
    isMoto: parsed.isMoto,
    sold: true,
  });

  const eyebrow = parsed.label ?? "Anúncio encerrado";
  const heading = parsed.label
    ? parsed.isMoto
      ? "Essa moto já foi vendida"
      : "Esse carro já foi vendido"
    : "Esse anúncio não está mais disponível";
  const description = parsed.label
    ? `${parsed.isMoto ? "A" : "O"} ${parsed.label} já saiu do nosso estoque, mas podemos te mostrar opções parecidas disponíveis hoje. Atendemos Linhares, Aracruz e Grande Vitória e combinamos o atendimento pelo WhatsApp.`
    : "O veículo deste link já pode ter sido vendido ou o endereço mudou. Fale com a gente pelo WhatsApp ou veja os seminovos disponíveis agora. Atendemos Linhares, Aracruz e Grande Vitória.";
  const gridHeading = parsed.isMoto
    ? "Opções parecidas no estoque"
    : "Carros parecidos no estoque";

  return (
    <div data-sold-link-fallback="">
      <Container size="content" className="py-6 sm:py-8 lg:py-10">
        <header className="max-w-2xl">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-cream sm:text-4xl">
            {heading}
          </h1>
          <div className="mt-3 h-0.5 w-12 bg-brand" aria-hidden="true" />
          <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
            {description}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <WhatsAppButton
              message={whatsappMessage}
              size="lg"
              trackingLabel="vendido-link-antigo"
              campaign="ficha"
              content="vendido-link-antigo"
              slug={parsed.model ?? undefined}
              className="w-full sm:w-auto"
            >
              Pedir parecido no WhatsApp
            </WhatsAppButton>
            <ButtonLink
              href="/estoque"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              Ver todo o estoque
            </ButtonLink>
          </div>
        </header>

        {similarVehicles.length > 0 ? (
          <section
            aria-labelledby="sold-similar-heading"
            data-sold-similar-vehicles=""
            className="mt-8 border-t border-white/10 pt-6 sm:mt-10 sm:pt-8"
          >
            <div className="mb-4 sm:mb-5">
              <h2
                id="sold-similar-heading"
                className="font-display text-xl font-semibold leading-tight tracking-tight text-cream sm:text-2xl"
              >
                {gridHeading}
              </h2>
              <div className="mt-2 h-px w-8 bg-brand" aria-hidden="true" />
            </div>
            <div
              className={
                similarVehicles.length === 1
                  ? "[&_.listing-card-item]:!col-span-1"
                  : undefined
              }
            >
              <VehicleGrid
                vehicles={similarVehicles}
                desktopCols={4}
                priorityCount={2}
                returnTo="/estoque"
                pageOrigin="card do estoque"
              />
            </div>
          </section>
        ) : null}
      </Container>
    </div>
  );
}
