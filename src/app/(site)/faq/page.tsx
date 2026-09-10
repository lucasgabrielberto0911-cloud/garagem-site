import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { FaqExplorer } from "@/components/site/FaqExplorer";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { buildPageMetadata, faqJsonLd } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getPublishedFaq } from "@/lib/site-content";

export const revalidate = 120;

export const metadata: Metadata = buildPageMetadata({
  title: `Dúvidas frequentes | ${site.name}`,
  description: `Como funciona a compra, a troca, o financiamento e a documentação na ${site.name} — seminovos em ${site.region} e região.`,
  path: "/faq",
});

export default async function FaqPage() {
  const items = await getPublishedFaq();
  return (
    <div className="py-12 lg:py-16">
      <JsonLd data={faqJsonLd(items)} />

      <Container size="narrow">
        <PageHeader
          eyebrow="Dúvidas frequentes"
          title="Tudo que perguntam antes de comprar"
          description="Busque por palavra-chave ou filtre por categoria. O assistente compara o estoque no site; para simular e fechar, chame no WhatsApp."
        />

        <div className="mt-8 lg:mt-10">
          <FaqExplorer items={items} />
        </div>

        <div className="mt-10 border border-brand/40 bg-ink p-6 text-center sm:p-8">
          <h2 className="font-display text-lg font-semibold text-cream sm:text-xl">
            Ficou com outra dúvida?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">
            Compare o estoque no assistente. Para parcela, troca ou fechamento,
            fale com a gente no WhatsApp.
          </p>
          <div className="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <ChatOpenButton source="faq" variant="outline">
              Ajuda para escolher
            </ChatOpenButton>
            <WhatsAppButton
              size="lg"
              trackingLabel="faq"
              message={WHATSAPP_MESSAGES.general}
            >
              Falar com a {site.name}
            </WhatsAppButton>
          </div>
        </div>

        <div className="mt-10">
          <WantedVehicleCta />
        </div>
      </Container>
    </div>
  );
}
