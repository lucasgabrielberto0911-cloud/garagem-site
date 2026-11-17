import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Como funciona comprar na ${site.name}`,
  description: `Atendemos Linhares, Aracruz e Grande Vitória e combinamos o atendimento pelo WhatsApp: vistoria e procedência, preparação do carro, vídeo detalhado, simulação, documentação e entrega.`,
  path: "/como-funciona",
});

const STEPS = [
  {
    title: "Vistoria e procedência",
    text: "Todo veículo passa por vistoria antes de entrar no estoque. Conferimos histórico, documentação e estado de conservação, para você saber de onde o carro vem.",
  },
  {
    title: "Preparação do carro",
    text: "Revisamos e deixamos o veículo pronto para a entrega: limpeza, itens de segurança e os ajustes necessários.",
  },
  {
    title: "Vídeo detalhado e simulação no WhatsApp",
    text: "Você escolhe o carro no site e pede o vídeo detalhado no WhatsApp. Se quiser, fazemos a simulação de financiamento ou da troca na mesma conversa.",
  },
  {
    title: "Documentação para transferência",
    text: "Deixamos a documentação preparada para a transferência, com orientação em cada etapa, sem burocracia desnecessária.",
  },
  {
    title: "Entrega combinada",
    text: "Combinamos com você a forma e a data da entrega. Dúvidas depois da compra? Falamos pelo mesmo WhatsApp.",
  },
] as const;

const NEXT_STEPS = [
  { href: "/estoque", label: "Ver estoque" },
  { href: "/financiamento", label: "Financiamento" },
  { href: "/vendidos", label: "Ver entregas realizadas" },
  { href: "/guias", label: "Guias de compra" },
] as const;

export default function ComoFuncionaPage() {
  return (
    <div className="py-12 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Como funciona", path: "/como-funciona" },
        ])}
      />
      <Container size="narrow">
        <PageHeader
          eyebrow="Como funciona"
          title={`Comprar na ${site.name}, passo a passo`}
          description="Atendemos Linhares, Aracruz e Grande Vitória. Combinamos o atendimento pelo WhatsApp: você escolhe, confere e fecha com segurança."
        />
        <ol className="mt-10 grid gap-3">
          {STEPS.map(({ title, text }, index) => (
            <li
              key={title}
              className="flex gap-4 border border-white/20 bg-ink p-4 text-left sm:p-5"
            >
              <span className="font-display text-lg font-bold leading-6 text-brand-light">
                {index + 1}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-cream">
                  {title}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-cream/80">
                  {text}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <WhatsAppButton message={WHATSAPP_MESSAGES.help} size="lg">
            Falar no WhatsApp
          </WhatsAppButton>
        </div>
        <nav
          aria-label="Próximos passos"
          className="mt-10 border-t border-white/20 pt-6"
        >
          <h2 className="text-center font-display text-xs font-semibold uppercase tracking-[0.16em] text-brand-light">
            Próximos passos
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {NEXT_STEPS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={false}
                  className="flex min-h-11 items-center justify-between gap-3 border border-white/20 bg-ink px-4 py-2 text-sm font-semibold text-cream transition hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
                >
                  {label}
                  <span aria-hidden="true" className="text-brand-light">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </div>
  );
}
