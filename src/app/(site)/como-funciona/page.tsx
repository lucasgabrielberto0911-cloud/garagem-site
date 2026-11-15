import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Como funciona comprar na ${site.name}`,
  description: `Loja 100% digital no Espírito Santo: vistoria e procedência, preparação do carro, vídeo detalhado, simulação no WhatsApp, documentação e entrega combinada.`,
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
          description="Loja 100% digital no Espírito Santo: você escolhe, confere e fecha com segurança, sem sair de casa."
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
          <p className="text-sm text-cream/80">
            Prefere ver os carros primeiro?{" "}
            <Link
              href="/estoque"
              className="font-semibold text-brand-light underline-offset-4 hover:underline"
            >
              Ver estoque
            </Link>
            {" · "}
            <Link
              href="/financiamento"
              className="font-semibold text-brand-light underline-offset-4 hover:underline"
            >
              Financiamento
            </Link>
          </p>
        </div>
      </Container>
    </div>
  );
}
