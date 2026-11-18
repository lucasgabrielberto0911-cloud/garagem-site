import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import {
  IconArrowRight,
  IconClipboardCheck,
  IconFileText,
  IconHandshake,
  IconShieldCheck,
} from "@/components/site/icons";
import {
  ButtonLink,
  Container,
  PageHeader,
  WhatsAppButton,
} from "@/components/site/ui";
import { breadcrumbJsonLd, buildPageMetadata, faqJsonLd } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Financiamento de seminovos em Linhares, Aracruz e Grande Vitória | ${site.name}`,
  description:
    "Financie em até 60x (sujeito à análise de crédito), cartão em até 18x e troca. Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp.",
  path: "/financiamento",
});

const OPTIONS = [
  {
    Icon: IconClipboardCheck,
    eyebrow: "Bancos parceiros",
    title: "Financiamento em até 60x",
    text: "Trabalhamos com bancos e financeiras parceiras. Aprovação, prazos, entrada e condições dependem da análise de crédito de cada caso.",
  },
  {
    Icon: IconShieldCheck,
    eyebrow: "Parcelamento direto",
    title: "Cartão em até 18x",
    text: "Também aceitamos cartão de crédito, com parcelamento em até 18 vezes para compor a entrada ou o valor combinado no atendimento.",
  },
  {
    Icon: IconHandshake,
    eyebrow: "Troca facilitada",
    title: "Seu veículo na troca",
    text: "Avaliamos o seu usado e abatemos o valor na compra — inclusive como parte da entrada. A avaliação é gratuita e sem compromisso.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    title: "Escolha o seminovo no estoque",
    text: "Veja as fotos, a ficha e a garantia de cada veículo disponível no site. Se preferir, peça um vídeo detalhado pelo WhatsApp.",
  },
  {
    title: "Envie os dados básicos no WhatsApp",
    text: "Nosso atendimento passa os dados com segurança para os bancos parceiros consultarem as opções disponíveis para o seu perfil.",
  },
  {
    title: "Análise de crédito pelos bancos",
    text: "As financeiras retornam com a resposta da análise, entrada possível e prazo aprovado. Tudo é explicado com clareza antes de fechar.",
  },
  {
    title: "Documentação e entrega combinada",
    text: "Com a aprovação confirmada, preparamos o contrato, a documentação para transferência e combinamos a entrega do veículo.",
  },
] as const;

const DOCUMENTS = [
  {
    label: "Documento com foto",
    detail: "CNH válida ou RG e CPF atualizados.",
  },
  {
    label: "Comprovante de residência",
    detail: "Conta recente de água, energia, internet ou telefone no seu nome (ou declaração aceita pelo banco).",
  },
  {
    label: "Comprovante de renda",
    detail: "Holerites recentes, extrato bancário dos últimos meses ou declaração de Imposto de Renda.",
  },
  {
    label: "Se houver veículo na troca",
    detail: "CRLV-e atualizado e fotos atuais do usado para agilizar a pré-avaliação.",
  },
] as const;

const FINANCIAMENTO_FAQ = [
  {
    question: "Preciso dar entrada para financiar?",
    answer:
      "Depende da análise de crédito de cada banco parceiro e do veículo escolhido. Em alguns perfis há possibilidade de financiamento com entrada reduzida ou sem entrada, enquanto outros pedem um valor inicial. Você também pode usar seu usado na troca ou o cartão em até 18x para compor a entrada.",
  },
  {
    question: "Autônomo ou MEI consegue financiar?",
    answer:
      "Sim. Bancos parceiros analisam autônomos e MEIs por meio de movimentação bancária, extratos recentes, faturamento ou declaração de Imposto de Renda, sempre sujeito à análise de crédito.",
  },
  {
    question: "Posso usar meu veículo atual na troca e financiar o restante?",
    answer:
      "Sim. Avaliamos o seu carro ou moto sem compromisso pelo WhatsApp ou pelo formulário de venda/troca, e o valor combinado entra para abater o saldo ou compor a entrada do financiamento.",
  },
  {
    question: "Quanto tempo leva a análise de crédito?",
    answer:
      "Na maioria dos casos, a resposta dos bancos sai no mesmo dia em horário comercial, depois do envio dos dados básicos. Se alguma financeira pedir documento complementar, avisamos na hora pelo WhatsApp.",
  },
  {
    question: "Dá para pagar parte no cartão de crédito e o restante à vista ou financiado?",
    answer:
      "Sim, é possível combinar formas de pagamento — como entrada no cartão em até 18x, veículo na troca e o saldo financiado em até 60x — conforme limite disponível e aprovação do banco.",
  },
  {
    question: "A consulta pelo WhatsApp gera algum compromisso?",
    answer:
      "Não. A conversa e a consulta inicial são gratuitas e sem compromisso. Você só segue se a condição aprovada fizer sentido para o seu bolso.",
  },
] as const;

export default function FinanciamentoPage() {
  return (
    <div className="py-10 lg:py-14">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Financiamento", path: "/financiamento" },
        ])}
      />
      <JsonLd data={faqJsonLd([...FINANCIAMENTO_FAQ])} />

      <Container>
        <PageHeader
          eyebrow="Financiamento · Linhares, Aracruz e Grande Vitória"
          title="Financiamento de seminovos em Linhares, Aracruz e Grande Vitória"
          description="Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp, sem compromisso — condições, entrada e prazos finais dependem da análise de crédito."
        />

        {/* Opções de pagamento em grade de 3 colunas no desktop */}
        <ul className="mt-8 grid gap-4 lg:mt-10 lg:grid-cols-3 lg:gap-5">
          {OPTIONS.map(({ Icon, eyebrow, title, text }) => (
            <li
              key={title}
              className="flex flex-col border border-white/20 bg-ink p-5 text-left sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-brand/40 bg-brand/10 text-brand-light">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-light">
                  {eyebrow}
                </p>
              </div>
              <h2 className="mt-4 font-display text-lg font-semibold text-cream">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-cream/80">
                {text}
              </p>
            </li>
          ))}
        </ul>

        {/* Ações principais logo abaixo das opções */}
        <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:mt-8">
          <WhatsAppButton
            message={WHATSAPP_MESSAGES.finance}
            size="lg"
            trackingLabel="financiamento"
          >
            Simular financiamento no WhatsApp
          </WhatsAppButton>
          <WhatsAppButton
            message={WHATSAPP_MESSAGES.sell}
            size="lg"
            variant="outline"
            trackingLabel="financiamento-troca"
          >
            Quero avaliar meu usado na troca
          </WhatsAppButton>
          <ButtonLink href="/vender" size="lg" variant="outline">
            Preencher dados do meu usado
          </ButtonLink>
        </div>

        {/* Como funciona + Documentos necessários lado a lado no desktop */}
        <div className="mt-12 grid gap-8 lg:mt-14 lg:grid-cols-12 lg:items-start">
          <section
            aria-labelledby="como-funciona-financiamento"
            className="lg:col-span-7"
          >
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
              Passo a passo
            </p>
            <h2
              id="como-funciona-financiamento"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-cream"
            >
              Como funciona o financiamento
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Todo o atendimento acontece de forma simples pelo WhatsApp, sem você precisar sair de casa antes de ter a aprovação definida.
            </p>
            <ol className="mt-5 grid gap-3 sm:grid-cols-2">
              {HOW_IT_WORKS.map(({ title, text }, index) => (
                <li
                  key={title}
                  className="flex gap-3.5 border border-white/20 bg-ink p-4 sm:p-5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-brand/40 bg-brand/10 font-display text-sm font-bold text-brand-light">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-semibold leading-snug text-cream">
                      {title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-cream/80">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <aside
            aria-labelledby="documentos-financiamento"
            className="border border-white/20 bg-ink p-5 sm:p-6 lg:col-span-5"
          >
            <div className="flex items-center gap-2.5">
              <IconFileText className="h-5 w-5 shrink-0 text-brand-light" />
              <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
                Checklist
              </p>
            </div>
            <h2
              id="documentos-financiamento"
              className="mt-1.5 font-display text-xl font-bold tracking-tight text-cream"
            >
              Documentos necessários
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-cream/80">
              Para agilizar a análise nos bancos parceiros, tenha em mãos:
            </p>
            <ul className="mt-4 space-y-3">
              {DOCUMENTS.map(({ label, detail }) => (
                <li
                  key={label}
                  className="flex items-start gap-2.5 border-b border-white/10 pb-3 last:border-b-0 last:pb-0"
                >
                  <IconShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold text-cream">
                      {label}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-cream/80">
                      {detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-white/15 pt-4 text-xs leading-relaxed text-muted">
              Observação: dependendo do perfil e do banco parceiro, a financeira pode solicitar comprovação complementar durante a análise de crédito.
            </p>
          </aside>
        </div>

        {/* Perguntas frequentes + Bloco de atendimento final */}
        <div className="mt-12 grid gap-8 lg:mt-14 lg:grid-cols-12 lg:items-start">
          <section
            aria-labelledby="faq-financiamento"
            className="lg:col-span-8"
          >
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
              Tire suas dúvidas
            </p>
            <h2
              id="faq-financiamento"
              className="mt-1 font-display text-2xl font-bold tracking-tight text-cream"
            >
              Perguntas frequentes sobre financiamento
            </h2>
            <div className="mt-5 space-y-2.5">
              {FINANCIAMENTO_FAQ.map((item) => (
                <details
                  key={item.question}
                  className="group border border-white/20 bg-ink transition open:border-brand/50"
                >
                  <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 font-display text-sm font-semibold text-cream sm:px-5 sm:text-base [&::-webkit-details-marker]:hidden">
                    <span>{item.question}</span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 font-display text-lg text-brand-light transition-transform duration-200 group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="border-t border-white/10 px-4 py-3.5 text-sm leading-relaxed text-cream/80 sm:px-5">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>

          <div className="border border-brand/40 bg-ink p-5 sm:p-6 lg:col-span-4">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
              Atendimento direto
            </p>
            <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-cream">
              Quer consultar suas condições agora?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-cream/80">
              Conte no WhatsApp qual carro você gostou e se pretende dar entrada ou usar seu usado na troca. A equipe retorna com as opções dos bancos parceiros.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <WhatsAppButton
                message={WHATSAPP_MESSAGES.finance}
                size="md"
                className="w-full"
                trackingLabel="financiamento-rodape"
              >
                Chamar no WhatsApp
              </WhatsAppButton>
              <Link
                href="/estoque"
                prefetch={false}
                className="inline-flex min-h-11 items-center justify-between border border-white/20 px-4 py-2.5 font-display text-sm font-semibold text-cream transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
              >
                <span>Explorar estoque disponível</span>
                <IconArrowRight className="h-4 w-4 text-brand-light" />
              </Link>
              <Link
                href="/como-funciona"
                prefetch={false}
                className="inline-flex min-h-11 items-center justify-between border border-white/20 px-4 py-2.5 font-display text-sm font-semibold text-cream transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
              >
                <span>Como funciona comprar na {site.name}</span>
                <IconArrowRight className="h-4 w-4 text-brand-light" />
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
