import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { WhatsAppButton } from "@/components/site/ui";
import { FAQ_ITEMS } from "@/lib/faq";
import { faqJsonLd } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Dúvidas frequentes | ${site.name}`,
  description: `Como funciona a compra, a troca, o financiamento e a documentação na ${site.name}.`,
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <div className="px-4 py-12 sm:px-6 lg:py-16">
      <JsonLd data={faqJsonLd(FAQ_ITEMS)} />

      <div className="mx-auto max-w-4xl">
        <header>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Dúvidas frequentes
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
            Tudo que perguntam antes de comprar
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
          <p className="mt-5 text-sm leading-relaxed text-muted sm:text-base">
            Se a sua dúvida não estiver aqui, chame no WhatsApp: respondemos no
            horário de atendimento.
          </p>
        </header>

        <div className="mt-10">
          <FaqAccordion items={FAQ_ITEMS} />
        </div>

        <div className="mt-10 border border-brand/40 bg-ink p-6 text-center sm:p-8">
          <h2 className="font-display text-lg font-semibold text-cream sm:text-xl">
            Ficou com outra dúvida?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Manda a pergunta no WhatsApp. Sem robô, sem formulário longo.
          </p>
          <WhatsAppButton
            className="mt-5"
            size="lg"
            message={WHATSAPP_MESSAGES.general}
          >
            Falar com a {site.name}
          </WhatsAppButton>
        </div>

        <div className="mt-10">
          <WantedVehicleCta />
        </div>
      </div>
    </div>
  );
}
