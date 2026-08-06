import type { Metadata } from "next";
import { SellForm } from "@/components/site/SellForm";
import { Container, PageHeader } from "@/components/site/ui";
import {
  IconClipboardCheck,
  IconHandshake,
  IconShieldCheck,
} from "@/components/site/icons";
import { site } from "@/lib/site";

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

export default function VenderPage() {
  return (
    <div className="py-12 lg:py-16">
      <Container size="narrow">
        <PageHeader
          eyebrow="Vender / Trocar"
          title="Avalie seu carro sem compromisso"
          description="Compramos seu usado e também aceitamos na troca por um veículo do nosso estoque. Preencha os dados abaixo que a gente retorna com uma proposta — sem taxa e sem compromisso."
        />

        <ul className="mt-8 flex gap-3 overflow-x-auto pb-1 scrollbar-hide sm:mt-12 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible">
          {STEPS.map(({ Icon, title, text }) => (
            <li
              key={title}
              className="flex w-[78%] max-w-xs shrink-0 flex-col items-center border border-white/10 bg-ink/60 p-5 text-center sm:w-auto sm:max-w-none sm:p-6"
            >
              <Icon className="h-7 w-7 text-brand" />
              <h2 className="mt-3 font-display text-sm font-semibold uppercase tracking-wide text-cream sm:mt-4">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ul>

        <section className="mt-10 sm:mt-14">
          <h2 className="text-center font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
            Dados do seu veículo
          </h2>
          <div
            className="mx-auto mt-4 h-0.5 w-16 bg-brand-gradient"
            aria-hidden="true"
          />
          <div className="mx-auto mt-8 max-w-2xl">
            <SellForm />
          </div>
        </section>
      </Container>
    </div>
  );
}
