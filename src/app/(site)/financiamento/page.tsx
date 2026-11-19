import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { RealStockPreview } from "@/components/site/RealStockPreview";
import {
  IconArrowRight,
  IconClipboardCheck,
  IconClock,
  IconFileText,
  IconHandshake,
  IconMapPin,
  IconShieldCheck,
} from "@/components/site/icons";
import {
  ButtonLink,
  Container,
  PageHeader,
  SectionHeading,
  WhatsAppButton,
} from "@/components/site/ui";
import { breadcrumbJsonLd, buildPageMetadata, faqJsonLd } from "@/lib/seo";
import { SiteLeadHit } from "@/lib/funnel-events";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { getFeaturedVehicles } from "@/lib/vehicles";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Financiamento de seminovos em Linhares, Aracruz e Grande Vitória | ${site.name}`,
  description:
    "Financie em até 60x (sujeito à análise de crédito), cartão em até 18x e troca. Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp.",
  path: "/financiamento",
});

const HERO_BADGES = [
  { value: "Até 60x", label: "Financiamento em bancos parceiros" },
  { value: "Até 18x", label: "No cartão de crédito" },
  { value: "Usado na troca", label: "Avaliação sem compromisso" },
] as const;

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
    detail:
      "Conta recente de água, energia, internet ou telefone no seu nome (ou declaração aceita pelo banco).",
  },
  {
    label: "Comprovante de renda",
    detail:
      "Holerites recentes, extrato bancário dos últimos meses ou declaração de Imposto de Renda.",
  },
  {
    label: "Se houver veículo na troca",
    detail:
      "CRLV-e atualizado e fotos atuais do usado para agilizar a pré-avaliação.",
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
    question:
      "Dá para pagar parte no cartão de crédito e o restante à vista ou financiado?",
    answer:
      "Sim, é possível combinar formas de pagamento — como entrada no cartão em até 18x, veículo na troca e o saldo financiado em até 60x — conforme limite disponível e aprovação do banco.",
  },
  {
    question: "A consulta pelo WhatsApp gera algum compromisso?",
    answer:
      "Não. A conversa e a consulta inicial são gratuitas e sem compromisso. Você só segue se a condição aprovada fizer sentido para o seu bolso.",
  },
] as const;

export default async function FinanciamentoPage() {
  const featured = await getFeaturedVehicles(3);

  return (
    <div>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Financiamento", path: "/financiamento" },
        ])}
      />
      <JsonLd data={faqJsonLd([...FINANCIAMENTO_FAQ])} />

      {/* 1. HERO COM PROFUNDIDADE, DESTAQUES E CTAS PRINCIPAIS */}
      <section className="hero-red-black relative isolate overflow-hidden border-b border-white/10 py-10 sm:py-14 lg:py-16">
        <div className="hero-color-field" aria-hidden="true">
          <span className="hero-red-orb hero-red-orb-1" />
          <span className="hero-red-orb hero-red-orb-2" />
        </div>
        <div className="hero-bottom-fade" aria-hidden="true" />

        <Container>
          <PageHeader
            eyebrow="Financiamento · Linhares, Aracruz e Grande Vitória"
            title="Financiamento de seminovos em Linhares, Aracruz e Grande Vitória"
            description="Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp, sem compromisso — condições, entrada e prazos finais dependem da análise de crédito."
          />

          <ul className="mx-auto mt-7 grid max-w-4xl gap-3 sm:grid-cols-3 sm:gap-4">
            {HERO_BADGES.map(({ value, label }) => (
              <li
                key={value}
                className="flex flex-col items-center rounded-2xl border border-white/15 bg-ink/85 px-4 py-4 text-center shadow-[0_14px_32px_-14px_rgba(0,0,0,0.85)] backdrop-blur-sm"
              >
                <span className="font-display text-2xl font-bold tracking-tight text-brand-light sm:text-[26px]">
                  {value}
                </span>
                <span className="mt-1 text-xs leading-snug text-cream/85 sm:text-sm">
                  {label}
                </span>
              </li>
            ))}
          </ul>

          {/* Ações principais logo no topo — alvos >=56px, empilhados no celular */}
          <div className="mx-auto mt-7 flex max-w-4xl flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <SiteLeadHit contentName="Financiamento">
              <WhatsAppButton
                message={WHATSAPP_MESSAGES.finance}
                size="lg"
                trackingLabel="financiamento"
                className="w-full rounded-xl !min-h-[56px] !text-base !normal-case !tracking-normal sm:w-auto"
              >
                Simular financiamento no WhatsApp
              </WhatsAppButton>
            </SiteLeadHit>
            <SiteLeadHit contentName="Financiamento - Troca">
              <WhatsAppButton
                message={WHATSAPP_MESSAGES.sell}
                size="lg"
                variant="outline"
                trackingLabel="financiamento-troca"
                className="w-full rounded-xl !min-h-[56px] !border-white/30 !bg-white/[0.05] !text-base !normal-case !tracking-normal hover:!border-[#25D366]/70 hover:!bg-white/[0.1] sm:w-auto"
              >
                Quero avaliar meu usado na troca
              </WhatsAppButton>
            </SiteLeadHit>
            <ButtonLink
              href="/vender"
              size="lg"
              variant="outline"
              className="w-full rounded-xl !min-h-[56px] !border-white/25 !bg-asphalt/70 !text-base !normal-case !tracking-normal hover:!border-brand hover:!bg-white/[0.08] sm:w-auto"
            >
              Preencher dados do meu usado
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* 2. OPÇÕES DE PAGAMENTO — FUNDO ALTERNADO E CARDS ELEVADOS */}
      <section className="border-b border-white/10 bg-ink/60 py-12 sm:py-14 lg:py-16">
        <Container>
          <SectionHeading
            eyebrow="Formas de pagamento"
            title="Combine entrada, troca e financiamento do jeito que cabe no seu plano"
            description="Explicamos cada opção com transparência pelo WhatsApp antes de você decidir."
          />

          <ul className="mt-7 grid gap-4 lg:mt-9 lg:grid-cols-3 lg:gap-5">
            {OPTIONS.map(({ Icon, eyebrow, title, text }) => (
              <li
                key={title}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-white/15 bg-asphalt p-6 text-left shadow-[0_18px_40px_-16px_rgba(0,0,0,0.88)] transition hover:border-brand/50"
              >
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-0.5 bg-brand/70"
                />
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/40 bg-brand/15 text-brand-light shadow-[0_6px_16px_rgba(217,21,25,0.2)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-light">
                    {eyebrow}
                  </p>
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-cream">
                  {title}
                </h2>
                <p className="mt-2.5 text-sm leading-relaxed text-cream/80 sm:text-[15px]">
                  {text}
                </p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 3. FOTOS REAIS DO ESTOQUE */}
      {featured.length > 0 ? (
        <section className="border-b border-white/10 bg-asphalt py-12 sm:py-14 lg:py-16">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHeading
                eyebrow="Estoque real disponível"
                title="Seminovos prontos para consultar financiamento"
                description="Escolha o modelo que combina com você e consulte as condições em até 60x direto pelo WhatsApp."
              />
              <Link
                href="/estoque"
                prefetch={false}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand-light transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
              >
                Ver todo o estoque
                <IconArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 lg:mt-8">
              <RealStockPreview vehicles={featured} variant="cards" />
            </div>
          </Container>
        </section>
      ) : null}

      {/* 4. COMO FUNCIONA + DOCUMENTOS NECESSÁRIOS — FUNDO ALTERNADO */}
      <section className="border-b border-white/10 bg-ink/60 py-12 sm:py-14 lg:py-16">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
            <div
              aria-labelledby="como-funciona-financiamento"
              className="lg:col-span-7"
            >
              <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
                Passo a passo
              </p>
              <h2
                id="como-funciona-financiamento"
                className="mt-1 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl"
              >
                Como funciona o financiamento
              </h2>
              <div className="mt-2.5 h-px w-10 bg-brand" aria-hidden="true" />
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-cream/80 sm:text-base">
                Todo o atendimento acontece de forma simples pelo WhatsApp, sem você precisar sair de casa antes de ter a aprovação definida.
              </p>
              <ol className="mt-6 grid gap-4 sm:grid-cols-2">
                {HOW_IT_WORKS.map(({ title, text }, index) => (
                  <li
                    key={title}
                    className="flex flex-col rounded-2xl border border-white/15 bg-asphalt p-5 shadow-[0_14px_34px_-14px_rgba(0,0,0,0.85)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-sm font-bold text-white shadow-[0_6px_14px_rgba(217,21,25,0.35)]">
                        {index + 1}
                      </span>
                      <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-light">
                        Passo 0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-3.5 font-display text-base font-bold leading-snug text-cream">
                      {title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-cream/80">
                      {text}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <aside
              aria-labelledby="documentos-financiamento"
              className="relative overflow-hidden rounded-2xl border border-brand/35 bg-asphalt p-6 shadow-[0_20px_46px_-16px_rgba(0,0,0,0.9)] sm:p-7 lg:col-span-5"
            >
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient"
              />
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/40 bg-brand/15 text-brand-light">
                  <IconFileText className="h-5 w-5" />
                </span>
                <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
                  Checklist
                </p>
              </div>
              <h2
                id="documentos-financiamento"
                className="mt-3 font-display text-xl font-bold tracking-tight text-cream sm:text-2xl"
              >
                Documentos necessários
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-cream/80">
                Para agilizar a análise nos bancos parceiros, tenha em mãos:
              </p>
              <ul className="mt-5 space-y-3.5">
                {DOCUMENTS.map(({ label, detail }) => (
                  <li
                    key={label}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-ink/80 p-3.5"
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
        </Container>
      </section>

      {/* 5. PERGUNTAS FREQUENTES + BLOCO DE ATENDIMENTO FINAL */}
      <section className="bg-asphalt py-12 sm:py-14 lg:py-16">
        <Container>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
            <div aria-labelledby="faq-financiamento" className="lg:col-span-8">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
                Tire suas dúvidas
              </p>
              <h2
                id="faq-financiamento"
                className="mt-1 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl"
              >
                Perguntas frequentes sobre financiamento
              </h2>
              <div className="mt-2.5 h-px w-10 bg-brand" aria-hidden="true" />
              <div className="mt-6 space-y-3">
                {FINANCIAMENTO_FAQ.map((item) => (
                  <details
                    key={item.question}
                    className="group overflow-hidden rounded-2xl border border-white/15 bg-ink shadow-[0_12px_28px_-12px_rgba(0,0,0,0.8)] transition open:border-brand/55 open:shadow-[0_16px_36px_-12px_rgba(217,21,25,0.22)]"
                  >
                    <summary className="flex min-h-[58px] cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-display text-sm font-semibold text-cream sm:text-base [&::-webkit-details-marker]:hidden">
                      <span>{item.question}</span>
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-asphalt font-display text-lg text-brand-light transition-transform duration-200 group-open:rotate-45 group-open:border-brand/40"
                      >
                        +
                      </span>
                    </summary>
                    <p className="border-t border-white/10 bg-asphalt/40 px-5 py-4 text-sm leading-relaxed text-cream/85 sm:text-[15px]">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-brand/40 bg-ink p-6 shadow-[0_22px_50px_-16px_rgba(0,0,0,0.9)] sm:p-7 lg:sticky lg:top-24 lg:col-span-4">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-0.5 bg-brand-gradient"
              />
              <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-brand-light">
                Atendimento direto
              </p>
              <h2 className="mt-1.5 font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
                Quer consultar suas condições agora?
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-cream/80">
                Conte no WhatsApp qual carro você gostou e se pretende dar entrada ou usar seu usado na troca. A equipe retorna com as opções dos bancos parceiros.
              </p>

              <div className="mt-4 space-y-2 border-y border-white/10 py-3.5 text-xs text-cream/80">
                <p className="flex items-center gap-2">
                  <IconClock className="h-4 w-4 shrink-0 text-brand-light" />
                  <span>{site.hours}</span>
                </p>
                <p className="flex items-center gap-2">
                  <IconMapPin className="h-4 w-4 shrink-0 text-brand-light" />
                  <span>Linhares, Aracruz e Grande Vitória</span>
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                <SiteLeadHit contentName="Financiamento">
                  <WhatsAppButton
                    message={WHATSAPP_MESSAGES.finance}
                    size="lg"
                    className="w-full rounded-xl !min-h-[56px] !text-base !normal-case !tracking-normal"
                    trackingLabel="financiamento-rodape"
                  >
                    Chamar no WhatsApp
                  </WhatsAppButton>
                </SiteLeadHit>
                <Link
                  href="/estoque"
                  prefetch={false}
                  className="inline-flex min-h-[48px] items-center justify-between rounded-xl border border-white/15 bg-asphalt px-4 py-2.5 font-display text-sm font-semibold text-cream transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
                >
                  <span>Explorar estoque disponível</span>
                  <IconArrowRight className="h-4 w-4 text-brand-light" />
                </Link>
                <Link
                  href="/como-funciona"
                  prefetch={false}
                  className="inline-flex min-h-[48px] items-center justify-between rounded-xl border border-white/15 bg-asphalt px-4 py-2.5 font-display text-sm font-semibold text-cream transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
                >
                  <span>Como funciona comprar na {site.name}</span>
                  <IconArrowRight className="h-4 w-4 text-brand-light" />
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
