import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Financiamento de seminovos | ${site.name}`,
  description: `Financie em até 60x com bancos parceiros (sujeito à análise de crédito), parcele no cartão em até 18x e use seu veículo na troca. Simulação pelo WhatsApp.`,
  path: "/financiamento",
});

const OPTIONS = [
  {
    title: "Financiamento em até 60x",
    text: "Trabalhamos com bancos e financeiras parceiras. Aprovação, taxas e CET dependem da análise de crédito de cada caso.",
  },
  {
    title: "Cartão em até 18x",
    text: "Também aceitamos cartão de crédito, com parcelamento em até 18 vezes.",
  },
  {
    title: "Seu veículo na troca",
    text: "Avaliamos o seu usado e abatemos o valor na compra. A avaliação é gratuita e sem compromisso.",
  },
] as const;

export default function FinanciamentoPage() {
  return (
    <div className="py-12 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Financiamento", path: "/financiamento" },
        ])}
      />
      <Container size="narrow">
        <PageHeader
          eyebrow="Financiamento"
          title="Formas de pagar seu seminovo"
          description="Simule pelo WhatsApp, sem compromisso. Valores e prazos finais dependem da análise de crédito."
        />
        <ul className="mt-10 grid gap-3">
          {OPTIONS.map(({ title, text }) => (
            <li
              key={title}
              className="border border-white/20 bg-ink p-4 text-left sm:p-5"
            >
              <h2 className="font-display text-base font-semibold text-cream">
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-cream/80">
                {text}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <WhatsAppButton message={WHATSAPP_MESSAGES.finance} size="lg">
            Simular no WhatsApp
          </WhatsAppButton>
          <p className="text-sm text-cream/80">
            Quer avaliar seu veículo?{" "}
            <Link
              href="/vender"
              className="font-semibold text-brand-light underline-offset-4 hover:underline"
            >
              Vender ou trocar
            </Link>
            {" · "}
            <Link
              href="/como-funciona"
              className="font-semibold text-brand-light underline-offset-4 hover:underline"
            >
              Como funciona
            </Link>
          </p>
        </div>
      </Container>
    </div>
  );
}
