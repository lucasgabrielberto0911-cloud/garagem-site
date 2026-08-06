import type { Metadata } from "next";
import Link from "next/link";
import { SellForm } from "@/components/site/SellForm";
import { Container, PageHeader } from "@/components/site/ui";
import {
  IconClipboardCheck,
  IconHandshake,
  IconShieldCheck,
} from "@/components/site/icons";
import { site } from "@/lib/site";
import { getVehicleById } from "@/lib/vehicles";

export const metadata: Metadata = {
  title: `Vender ou trocar seu carro | ${site.name}`,
  description: `Avaliação gratuita e sem compromisso do seu veículo na ${site.name}. Compramos seu usado e aceitamos na troca.`,
  alternates: { canonical: "/vender" },
};

const STEPS = [
  {
    Icon: IconClipboardCheck,
    title: "1. Você manda os dados",
    text: "Preencha o formulário com as informações do veículo. Leva menos de dois minutos.",
  },
  {
    Icon: IconShieldCheck,
    title: "2. A gente avalia",
    text: "Consultamos tabela, histórico e estado de conservação para chegar a um valor justo.",
  },
  {
    Icon: IconHandshake,
    title: "3. Fechamos o negócio",
    text: "Proposta na mão, você decide: venda direta ou troca por um veículo do nosso estoque.",
  },
] as const;

export default async function VenderPage({
  searchParams,
}: {
  searchParams: { interesse?: string; label?: string };
}) {
  const interestId = searchParams.interesse?.trim();
  const interestLabel =
    searchParams.label?.trim() ||
    (interestId
      ? await getVehicleById(interestId).then((vehicle) =>
          vehicle
            ? `${vehicle.brand} ${vehicle.model} ${vehicle.yearModel}`
            : "",
        )
      : "");

  return (
    <div className="py-12 lg:py-16">
      <Container size="narrow">
        <PageHeader
          eyebrow="Vender / Trocar"
          title="Avalie seu carro sem compromisso"
          description="Compramos seu usado e também aceitamos na troca por um veículo do nosso estoque. Preencha os dados abaixo que a gente retorna com uma proposta — sem taxa e sem compromisso."
        />

        {interestLabel ? (
          <div className="mt-6 border border-brand/30 bg-ink px-4 py-3 text-center text-sm text-cream lg:text-left">
            Interesse na troca por:{" "}
            <strong className="font-display">{interestLabel}</strong>
            {interestId ? (
              <>
                {" · "}
                <Link
                  href={`/estoque/${interestId}`}
                  className="text-brand underline-offset-4 hover:underline"
                >
                  Ver anúncio
                </Link>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="mt-8 lg:mt-10 lg:grid lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-10">
          <aside className="lg:sticky lg:top-24">
            <ul className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide lg:flex-col lg:overflow-visible lg:gap-4">
              {STEPS.map(({ Icon, title, text }) => (
                <li
                  key={title}
                  className="flex w-[78%] max-w-xs shrink-0 flex-col items-center border border-white/10 bg-ink/60 p-5 text-center lg:w-auto lg:max-w-none lg:items-start lg:text-left"
                >
                  <Icon className="h-7 w-7 text-brand" />
                  <h2 className="mt-3 font-display text-sm font-semibold uppercase tracking-wide text-cream">
                    {title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ul>
          </aside>

          <section className="mt-10 lg:mt-0">
            <h2 className="text-center font-display text-xl font-bold tracking-tight text-cream sm:text-2xl lg:text-left">
              Dados do seu veículo
            </h2>
            <div
              className="mx-auto mt-4 h-0.5 w-16 bg-brand-gradient lg:mx-0"
              aria-hidden="true"
            />
            <div className="mt-8">
              <SellForm
                interestNote={
                  interestLabel
                    ? `Interesse na troca pelo veículo: ${interestLabel}${interestId ? ` (id ${interestId})` : ""}`
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
