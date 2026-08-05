import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleCard } from "@/components/site/VehicleCard";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { ButtonLink, WhatsAppButton } from "@/components/site/ui";
import { IconArrowRight } from "@/components/site/icons";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getRelatedVehicles, getVehicleById } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const vehicle = await getVehicleById(params.id);
  if (!vehicle) return { title: `Veículo não encontrado | ${site.name}` };

  return {
    title: `${vehicle.brand} ${vehicle.model} ${vehicle.yearModel} | ${site.name}`,
    description:
      vehicle.description ??
      `${vehicle.brand} ${vehicle.model} ${vehicle.year}/${vehicle.yearModel} com ${formatNumberBR(vehicle.km)} km disponível na ${site.name}.`,
  };
}

export default async function VehicleDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const vehicle = await getVehicleById(params.id);
  if (!vehicle) notFound();

  const title = `${vehicle.brand} ${vehicle.model}`;
  const fullLabel = `${title}${vehicle.version ? ` ${vehicle.version}` : ""} ${vehicle.yearModel}`;
  const related = await getRelatedVehicles(vehicle.id, vehicle.brand);

  const specs = [
    { label: "Ano", value: `${vehicle.year}/${vehicle.yearModel}` },
    { label: "Quilometragem", value: `${formatNumberBR(vehicle.km)} km` },
    { label: "Câmbio", value: vehicle.transmission },
    { label: "Combustível", value: vehicle.fuel },
    ...(vehicle.color ? [{ label: "Cor", value: vehicle.color }] : []),
    ...(vehicle.version ? [{ label: "Versão", value: vehicle.version }] : []),
  ];

  return (
    <div className="px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-7xl">
        <nav aria-label="Você está aqui" className="text-xs text-muted">
          <Link href="/" className="transition hover:text-cream">
            Início
          </Link>
          <span className="mx-2">/</span>
          <Link href="/estoque" className="transition hover:text-cream">
            Estoque
          </Link>
          <span className="mx-2">/</span>
          <span className="text-cream">{title}</span>
        </nav>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <VehicleGallery photos={vehicle.photos} alt={fullLabel} />

            {vehicle.description ? (
              <div className="mt-8 border border-white/10 bg-ink p-6">
                <h2 className="font-display text-lg font-semibold text-cream">
                  Sobre este veículo
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
                  {vehicle.description}
                </p>
              </div>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-white/10 bg-ink p-6">
              {vehicle.status === "reservado" ? (
                <span className="inline-block bg-brand-orange px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-wider text-asphalt">
                  Reservado
                </span>
              ) : null}
              <h1 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight text-cream sm:text-3xl">
                {title}
              </h1>
              {vehicle.version ? (
                <p className="mt-1.5 text-sm text-muted">{vehicle.version}</p>
              ) : null}

              <p className="mt-6 font-display text-3xl font-bold text-cream">
                {formatCurrencyBRL(vehicle.price)}
              </p>

              <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden border border-white/10 bg-white/10">
                {specs.map((spec) => (
                  <div key={spec.label} className="bg-asphalt px-4 py-3">
                    <dt className="text-[10px] uppercase tracking-wider text-muted">
                      {spec.label}
                    </dt>
                    <dd className="mt-0.5 truncate font-display text-sm font-semibold text-cream">
                      {spec.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 flex flex-col gap-3">
                <WhatsAppButton
                  size="lg"
                  message={WHATSAPP_MESSAGES.vehicle(fullLabel)}
                >
                  Tenho interesse
                </WhatsAppButton>
                <ButtonLink href="/vender" size="md" variant="outline">
                  Quero dar meu carro na troca
                </ButtonLink>
              </div>

              <p className="mt-5 text-xs leading-relaxed text-muted">
                Valores e disponibilidade sujeitos a alteração. Consulte as
                condições de financiamento pelo WhatsApp {site.whatsappLabel}.
              </p>
            </div>
          </aside>
        </div>

        {related.length > 0 ? (
          <section className="mt-16 border-t border-white/5 pt-12">
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
                Outros {vehicle.brand} no estoque
              </h2>
              <Link
                href="/estoque"
                className="inline-flex shrink-0 items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
              >
                Ver todos
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((item) => (
                <VehicleCard key={item.id} vehicle={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
