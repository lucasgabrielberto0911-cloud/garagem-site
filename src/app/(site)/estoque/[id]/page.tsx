import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VehicleGallery } from "@/components/site/VehicleGallery";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { VehicleMobileBar } from "@/components/site/VehicleMobileBar";
import { ButtonLink, Container, WhatsAppButton } from "@/components/site/ui";
import { IconArrowRight } from "@/components/site/icons";
import { FavoriteButton } from "@/components/site/FavoriteButton";
import { JsonLd } from "@/components/JsonLd";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { absoluteUrl, breadcrumbJsonLd, vehicleJsonLd } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getRelatedVehicles, getVehicleById } from "@/lib/vehicles";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const vehicle = await getVehicleById(params.id);
  if (!vehicle) return { title: `Veículo não encontrado | ${site.name}` };

  const title = `${vehicle.brand} ${vehicle.model} ${vehicle.yearModel} | ${site.name}`;
  const description =
    vehicle.description ??
    `${vehicle.brand} ${vehicle.model} ${vehicle.year}/${vehicle.yearModel} com ${formatNumberBR(vehicle.km)} km disponível na ${site.name}.`;
  const cover = vehicle.photos[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `/estoque/${vehicle.id}` },
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(`/estoque/${vehicle.id}`),
      images: cover ? [{ url: cover }] : ["/og.png"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: cover ? [cover] : ["/og.png"],
    },
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
  const related = await getRelatedVehicles(
    vehicle.id,
    vehicle.brand,
    4,
    vehicle.category,
  );

  const specs = [
    {
      label: "Tipo",
      value: vehicle.category === "moto" ? "Moto" : "Carro",
    },
    { label: "Ano", value: `${vehicle.year}/${vehicle.yearModel}` },
    { label: "Quilometragem", value: `${formatNumberBR(vehicle.km)} km` },
    { label: "Câmbio", value: vehicle.transmission },
    { label: "Combustível", value: vehicle.fuel },
    ...(vehicle.color ? [{ label: "Cor", value: vehicle.color }] : []),
    ...(vehicle.version ? [{ label: "Versão", value: vehicle.version }] : []),
  ];

  return (
    <div className="py-10 pb-sticky-bar-safe lg:py-14 lg:pb-14">
      <JsonLd data={vehicleJsonLd(vehicle)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Estoque", path: "/estoque" },
          { name: fullLabel, path: `/estoque/${vehicle.id}` },
        ])}
      />
      <Container>
        <nav
          aria-label="Você está aqui"
          className="text-center text-xs text-muted"
        >
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

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <VehicleGallery photos={vehicle.photos} alt={fullLabel} />

            {vehicle.description ? (
              <div className="mt-8 border border-white/10 bg-ink p-6 text-center">
                <h2 className="font-display text-lg font-semibold text-cream">
                  Sobre este veículo
                </h2>
                <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-sm leading-relaxed text-muted">
                  {vehicle.description}
                </p>
              </div>
            ) : null}

            {vehicle.accessories.length > 0 ? (
              <div className="mt-8 border border-white/10 bg-ink p-6">
                <h2 className="text-center font-display text-lg font-semibold text-cream">
                  Itens e acessórios
                </h2>
                <ul className="mx-auto mt-5 grid max-w-2xl gap-2 sm:grid-cols-2">
                  {vehicle.accessories.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-sm text-muted"
                    >
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-brand"
                        aria-hidden="true"
                      />
                      <span className="leading-relaxed text-cream/90">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="border border-white/10 bg-ink p-6 text-center">
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
                  <div key={spec.label} className="bg-asphalt px-4 py-3 text-center">
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <WhatsAppButton
                    variant="outline"
                    message={WHATSAPP_MESSAGES.vehicleVisit(fullLabel)}
                  >
                    Agendar visita
                  </WhatsAppButton>
                  <WhatsAppButton
                    variant="outline"
                    message={WHATSAPP_MESSAGES.vehicleVideo(fullLabel)}
                  >
                    Pedir vídeo
                  </WhatsAppButton>
                </div>

                <FavoriteButton
                  vehicleId={vehicle.id}
                  label={fullLabel}
                  variant="full"
                  className="w-full"
                />

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
            <h2 className="text-center font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
              Outros {vehicle.brand} no estoque
            </h2>
            <div
              className="mx-auto mt-4 h-0.5 w-16 bg-brand-gradient"
              aria-hidden="true"
            />
            <div className="mt-8">
              <VehicleGrid vehicles={related} />
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/estoque"
                className="inline-flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand transition hover:text-brand-orange"
              >
                Ver todo o estoque
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ) : null}
      </Container>

      <VehicleMobileBar
        brand={vehicle.brand}
        model={vehicle.model}
        year={vehicle.yearModel}
        price={vehicle.price}
      />
    </div>
  );
}
