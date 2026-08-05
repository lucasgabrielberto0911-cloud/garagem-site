import type { Metadata } from "next";
import { SellForm } from "@/components/site/SellForm";
import {
  IconClipboardCheck,
  IconHandshake,
  IconShieldCheck,
} from "@/components/site/icons";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Vender ou trocar seu carro | ${site.name}`,
  description: `Avaliação gratuita e sem compromisso do seu veículo na ${site.name}. Compramos seu usado e aceitamos na troca.`,
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
    <div className="px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-5xl">
        <header>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Vender / Trocar
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
            Avalie seu carro sem compromisso
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            Compramos seu usado e também aceitamos na troca por um veículo do
            nosso estoque. Preencha os dados abaixo que a gente retorna com uma
            proposta — sem taxa e sem compromisso.
          </p>
        </header>

        <ul className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map(({ Icon, title, text }) => (
            <li key={title} className="border border-white/10 bg-ink/60 p-6">
              <Icon className="h-6 w-6 text-brand" />
              <h2 className="mt-4 font-display text-sm font-semibold uppercase tracking-wide text-cream">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ul>

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
            Dados do seu veículo
          </h2>
          <div className="mt-6">
            <SellForm />
          </div>
        </section>
      </div>
    </div>
  );
}
