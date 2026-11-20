import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { SiteLeadHit } from "@/lib/funnel-events";
import { SellForm } from "@/components/site/SellForm";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { vehiclePath } from "@/lib/vehicle-slug";
import { getVehicleById } from "@/lib/vehicles";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Vender ou trocar seu veículo | ${site.name}`,
  description: `Avaliação gratuita e sem compromisso do seu veículo na ${site.name}. Compramos seu usado e aceitamos na troca em ${site.region}.`,
  path: "/vender",
});

const STEPS = [
  {
    title: "Você manda os dados",
    text: "Preencha só 5 informações rápidas sobre você e o carro. Leva menos de dois minutos.",
  },
  {
    title: "A gente avalia",
    text: "Analisamos tabela, histórico e estado de conservação para chegar a uma proposta justa.",
  },
  {
    title: "Fechamos o negócio",
    text: "Proposta na mão, você decide: venda direta ou troca por um veículo do nosso estoque.",
  },
] as const;

const GUARANTEES = [
  "Atendemos Linhares, Aracruz e Grande Vitória.",
  "Combinamos o atendimento pelo WhatsApp, das 8h às 23h.",
  "Avaliação gratuita, sem taxa e sem compromisso.",
] as const;

export default async function VenderPage({
  searchParams,
}: {
  searchParams: Promise<{ interesse?: string; label?: string }>;
}) {
  const query = await searchParams;
  const interestId = query.interesse?.trim();
  const interestVehicle = interestId ? await getVehicleById(interestId) : null;
  const interestLabel =
    query.label?.trim() ||
    (interestVehicle
      ? `${interestVehicle.brand} ${interestVehicle.model} ${interestVehicle.yearModel}`
      : "");

  return (
    <div data-clear-fab="" className="clear-fab-screen lg:py-12">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Vender ou trocar", path: "/vender" },
        ])}
      />
      <Container className="pt-5 lg:pt-0">
        <PageHeader
          compact
          eyebrow="Vender / Trocar"
          title="Avalie seu veículo sem compromisso"
          description="Compramos seu usado e também aceitamos na troca por um veículo do nosso estoque. Preencha os dados — retornamos no WhatsApp, das 8h às 23h, sem taxa e sem compromisso."
        />

        {interestLabel ? (
          <div className="mx-auto mt-5 max-w-3xl overflow-hidden rounded-xl border border-brand/40 bg-ink shadow-[0_12px_32px_rgba(0,0,0,0.32)]">
            <div className="h-1 bg-brand-gradient" aria-hidden="true" />
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5">
              <div className="min-w-0">
                <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-brand-light">
                  Interesse na troca
                </p>
                <p className="mt-1 font-display text-base font-bold text-cream sm:text-lg">
                  {interestLabel}
                </p>
              </div>
              {interestVehicle ? (
                <Link
                  href={vehiclePath(interestVehicle)}
                  className="inline-flex min-h-11 items-center rounded-lg border border-brand/40 bg-asphalt px-4 text-sm font-semibold text-brand-light transition hover:border-brand hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Ver anúncio
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:mt-10 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:items-start lg:gap-x-10 xl:gap-x-12">
          <aside className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-white/15 bg-ink shadow-[0_12px_32px_rgba(0,0,0,0.32)]">
              <div className="h-1 bg-brand-gradient" aria-hidden="true" />
              <div className="p-4 sm:p-5">
                <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-light">
                  Passo a passo
                </p>
                <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-cream">
                  Como funciona
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-cream/80">
                  Do envio dos dados à proposta, tudo direto com a nossa equipe.
                </p>

                <ol className="mt-4 grid gap-3">
                  {STEPS.map(({ title, text }, index) => (
                    <li
                      key={title}
                      className="flex gap-3.5 rounded-lg border border-white/10 bg-asphalt/90 p-3.5 sm:p-4"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand font-display text-sm font-bold text-cream shadow-[0_4px_12px_rgba(217,21,25,0.35)]">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-base font-semibold leading-snug text-cream">
                          {title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed text-cream/80">
                          {text}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="rounded-xl border border-white/15 bg-ink p-4 shadow-[0_10px_28px_rgba(0,0,0,0.24)] sm:p-5">
              <h2 className="font-display text-base font-bold text-cream">
                Atendimento direto com a equipe
              </h2>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-cream/80">
                {GUARANTEES.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-light"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>

          <section aria-labelledby="vender-form-heading" className="min-w-0">
            <div className="mb-7 overflow-hidden rounded-xl border border-white/15 bg-ink shadow-[0_12px_32px_rgba(0,0,0,0.32)]">
              <div className="h-1 bg-brand-gradient" aria-hidden="true" />
              <div className="p-4 sm:p-6">
                <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-light">
                  Atalho mais rápido
                </p>
                <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
                  Prefere falar direto no WhatsApp?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-cream/80 sm:text-base">
                  Sem formulário: você manda as fotos e os dados do carro na
                  conversa e a gente avalia por lá.
                </p>
                <div className="mt-4">
                  <SiteLeadHit contentName="Vender/Trocar">
                    <WhatsAppButton
                      size="lg"
                      className="w-full rounded-lg"
                      trackingLabel="vender"
                      message={WHATSAPP_MESSAGES.sell}
                    >
                      Mandar fotos e dados pelo WhatsApp
                    </WhatsAppButton>
                  </SiteLeadHit>
                </div>
                <p className="mt-3.5 text-sm leading-relaxed text-cream/75">
                  Ou, se preferir, preencha o formulário abaixo — só 5 campos
                  essenciais.
                </p>
              </div>
            </div>

            <div>
              <h2
                id="vender-form-heading"
                className="font-display text-2xl font-bold tracking-tight text-cream sm:text-[1.75rem]"
              >
                Dados do seu veículo
              </h2>
              <div
                className="mt-2.5 h-1 w-16 rounded-full bg-brand-gradient"
                aria-hidden="true"
              />
              <p className="mt-2.5 text-sm leading-relaxed text-cream/80 sm:text-base">
                Preencha o essencial em duas etapas curtas. Placa, km e fotos
                ficam à parte e são opcionais.
              </p>
            </div>

            <div className="mt-5">
              <SellForm
                interestVehicleId={interestVehicle?.id}
                interestNote={
                  interestLabel
                    ? `Interesse na troca pelo veículo: ${interestLabel}${interestVehicle ? ` (id ${interestVehicle.id})` : ""}`
                    : undefined
                }
              />
            </div>
          </section>
        </div>
      </Container>
    </div>
  );
}
