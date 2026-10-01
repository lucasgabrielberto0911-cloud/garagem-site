import type { Metadata } from "next";
import Link from "next/link";
import { SellForm } from "@/components/site/SellForm";
import { Container, PageHeader } from "@/components/site/ui";
import { buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { vehiclePath } from "@/lib/vehicle-slug";
import { getVehicleById } from "@/lib/vehicles";

export const revalidate = 600;

export const metadata: Metadata = buildPageMetadata({
  title: `Vender ou trocar seu veículo | ${site.name}`,
  description: `Avaliação gratuita e sem compromisso do seu veículo na ${site.name}. Compramos seu usado e aceitamos na troca em ${site.region} e região.`,
  path: "/vender",
});

const STEPS = [
  {
    title: "Você manda os dados",
    text: "Preencha o formulário com as informações do veículo. Leva menos de dois minutos.",
  },
  {
    title: "A gente avalia",
    text: "Consultamos tabela, histórico e estado de conservação para chegar a um valor justo.",
  },
  {
    title: "Fechamos o negócio",
    text: "Proposta na mão, você decide: venda direta ou troca por um veículo do nosso estoque.",
  },
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
    <div className="py-8 lg:py-12">
      <Container>
        <PageHeader
          eyebrow="Vender / Trocar"
          title="Avalie seu veículo sem compromisso"
          description="Compramos seu usado e também aceitamos na troca por um veículo do nosso estoque. Preencha os dados — retornamos no WhatsApp, das 8h às 23h, sem taxa e sem compromisso."
        />

        {interestLabel ? (
          <div className="mt-5 border border-brand/30 bg-ink px-4 py-3 text-left text-sm text-cream">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
              Interesse na troca
            </p>
            <p className="mt-1 font-display font-semibold">
              {interestLabel}
              {interestVehicle ? (
                <>
                  {" · "}
                  <Link
                    href={vehiclePath(interestVehicle)}
                    className="text-brand underline-offset-4 hover:underline"
                  >
                    Ver anúncio
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        <div className="mt-6 lg:mt-10 lg:grid lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)] lg:items-start lg:gap-10 xl:gap-14">
          <aside className="lg:sticky lg:top-24">
            <h2 className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              Como funciona
            </h2>
            <ol className="mt-3 grid gap-1.5">
              {STEPS.map(({ title, text }, index) => (
                <li
                  key={title}
                  className="flex gap-3 border border-white/10 bg-ink px-3.5 py-3"
                >
                  <span className="font-display text-sm font-bold leading-5 text-brand">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-semibold text-cream">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-snug text-muted">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>

          <section className="mt-6 lg:mt-0">
            <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
              Dados do seu veículo
            </h2>
            <div className="mt-3 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
            <div className="mt-4">
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
