import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ScrollReveal } from "@/components/site/ScrollReveal";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { WhatsAppButton } from "@/components/site/ui";
import { faqJsonLd } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Dúvidas frequentes | ${site.name}`,
  description: `Como funciona a compra, a troca, o financiamento e a documentação na ${site.name}.`,
  alternates: { canonical: "/faq" },
};

const FAQ = [
  {
    question: "Como funciona a compra de um veículo na Garagem?",
    answer:
      "Você escolhe o veículo no site, chama no WhatsApp e a gente separa o carro para você ver de perto. Depois do aceite, cuidamos de toda a documentação de transferência e combinamos a forma de pagamento.",
  },
  {
    question: "Vocês aceitam meu carro na troca?",
    answer:
      "Sim. Avaliamos seu usado e o valor entra como parte do pagamento. Para agilizar, preencha o formulário da página Vender/Trocar com marca, modelo, ano e quilometragem — a avaliação inicial sai pelo WhatsApp e a final é feita na loja, com o carro presente.",
  },
  {
    question: "Trabalham com financiamento?",
    answer:
      "Sim, com bancos e financeiras parceiras. A aprovação e as taxas dependem da análise de crédito de cada instituição, então as condições são passadas caso a caso pelo WhatsApp. Também aceitamos pagamento à vista e entrada mais parcelas.",
  },
  {
    question: "Os veículos passam por vistoria?",
    answer:
      "Todo veículo do estoque passa por checagem de procedência, conferência de quilometragem e vistoria mecânica antes de ser anunciado. Se algo relevante for identificado, isso é informado antes da negociação.",
  },
  {
    question: "Posso agendar uma visita ou test drive?",
    answer:
      "Pode e recomendamos. Chame no WhatsApp, escolha o dia e o horário, e deixamos o veículo separado e pronto para você conhecer sem correria.",
  },
  {
    question: "Podem me mandar mais fotos ou um vídeo do carro?",
    answer:
      "Sim. Na página de cada veículo existe o botão “Pedir vídeo”, que já abre o WhatsApp com o modelo escolhido. Gravamos o vídeo mostrando os detalhes que você pedir.",
  },
  {
    question: "Os preços do site estão sempre atualizados?",
    answer:
      "O site é atualizado pela própria loja, mas valores e disponibilidade podem mudar ao longo do dia — principalmente em veículos com muita procura. Confirme sempre pelo WhatsApp antes de fechar.",
  },
  {
    question: "Como funciona a transferência de documentação?",
    answer:
      "A Garagem cuida do processo de transferência junto ao Detran. Os prazos e custos variam conforme o município e a forma de pagamento, e são informados antes do fechamento do negócio.",
  },
  {
    question: "Vocês atendem outras cidades do Espírito Santo?",
    answer: `Sim. Atendemos clientes de todo o ${site.state} e organizamos a entrega ou a retirada conforme a região. Fale com a gente que combinamos a melhor forma.`,
  },
];

export default function FaqPage() {
  return (
    <div className="px-4 py-12 sm:px-6 lg:py-16">
      <JsonLd data={faqJsonLd(FAQ)} />

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

        <div className="mt-10 divide-y divide-white/10 border border-white/10 bg-ink">
          {FAQ.map((item, index) => (
            <ScrollReveal key={item.question} delay={index * 40}>
              <details className="group px-5 py-4 sm:px-6">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-display text-base font-semibold text-cream marker:hidden">
                  {item.question}
                  <span
                    className="mt-1 shrink-0 text-brand transition-transform duration-300 group-open:rotate-45"
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="h-4 w-4"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {item.answer}
                </p>
              </details>
            </ScrollReveal>
          ))}
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
            Falar com a Garagem
          </WhatsAppButton>
        </div>

        <div className="mt-10">
          <WantedVehicleCta />
        </div>
      </div>
    </div>
  );
}
