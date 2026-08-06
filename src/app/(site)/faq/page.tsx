import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { FaqAccordion } from "@/components/site/FaqAccordion";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
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
    <div className="py-12 lg:py-16">
      <JsonLd data={faqJsonLd(FAQ_ITEMS)} />

      <Container size="narrow">
        <PageHeader
          eyebrow="Dúvidas frequentes"
          title="Tudo que perguntam antes de comprar"
          description="Se a sua dúvida não estiver aqui, chame no WhatsApp: respondemos no horário de atendimento."
        />

        <nav
          aria-label="Índice de dúvidas"
          className="mt-8 hidden flex-wrap gap-2 lg:flex"
        >
          {FAQ_ITEMS.map((item, index) => {
            const id = `faq-${item.question
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/(^-|-$)/g, "")
              .slice(0, 64) || index}`;
            return (
              <a
                key={item.question}
                href={`#${id}`}
                className="inline-flex min-h-[36px] items-center border border-white/10 px-3 text-xs text-muted transition hover:border-brand hover:text-cream"
              >
                {item.question.length > 42
                  ? `${item.question.slice(0, 42)}…`
                  : item.question}
              </a>
            );
          })}
        </nav>

        <div className="mt-8 lg:mt-10">
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
      </Container>
    </div>
  );
}
