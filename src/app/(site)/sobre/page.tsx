import type { Metadata } from "next";
import Image from "next/image";
import { TrustBadges } from "@/components/site/TrustBadges";
import { ButtonLink, WhatsAppButton } from "@/components/site/ui";
import {
  IconClipboardCheck,
  IconHandshake,
  IconShieldCheck,
} from "@/components/site/icons";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Sobre a ${site.name}`,
  description: `Conheça a ${site.name}: história, missão e os diferenciais de quem vende seminovo com procedência no ${site.state}.`,
};

const DIFERENCIAIS = [
  {
    Icon: IconClipboardCheck,
    title: "Vistoria antes da vitrine",
    text: "[TEXTO EDITÁVEL] Descreva aqui o processo de checagem que todo veículo passa antes de ser anunciado: itens avaliados, quem faz o laudo e o que o cliente recebe por escrito.",
  },
  {
    Icon: IconShieldCheck,
    title: "Procedência e documentação",
    text: "[TEXTO EDITÁVEL] Explique como vocês verificam histórico, débitos e restrições, e como conduzem a transferência para o cliente sair com tudo regularizado.",
  },
  {
    Icon: IconHandshake,
    title: "Atendimento direto com o dono",
    text: "[TEXTO EDITÁVEL] Conte como funciona o atendimento: quem recebe o cliente, o tempo de resposta no WhatsApp e o acompanhamento depois da venda.",
  },
] as const;

export default function SobrePage() {
  return (
    <div>
      <section className="px-4 py-12 sm:px-6 lg:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Sobre nós
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
            A {site.name}
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted sm:text-base">
            [TEXTO EDITÁVEL] Resuma em duas ou três linhas o posicionamento da
            loja: o que vocês vendem, para quem, e o que faz a {site.name} ser
            diferente das outras revendas de {site.region}.
          </p>
        </div>
      </section>

      <section className="px-4 pb-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="relative aspect-[16/7] overflow-hidden border border-white/10">
            <Image
              src="/branding/hero-bg.jpg"
              alt={`Estoque da ${site.name}`}
              fill
              sizes="(min-width: 1024px) 1024px, 100vw"
              className="object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-asphalt/80 to-transparent"
              aria-hidden="true"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6 lg:py-16">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
          <article>
            <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
              Nossa história
            </h2>
            <div className="mt-4 h-0.5 w-12 bg-brand-gradient" aria-hidden="true" />
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
              <p>
                [TEXTO EDITÁVEL] Conte quando e como a {site.name} começou: quem
                fundou, o que motivou abrir a loja e como era o começo — se
                nasceu de outra atividade, de uma paixão por carros, de um
                negócio de família.
              </p>
              <p>
                [TEXTO EDITÁVEL] Descreva a evolução: mudança de endereço,
                crescimento do estoque, ampliação dos serviços (financiamento,
                troca, consignação) e o momento atual da loja em{" "}
                {site.region}.
              </p>
              <p>
                [TEXTO EDITÁVEL] Feche com o presente: quantas famílias já foram
                atendidas, a relação com clientes que voltam e o que vem por
                aí.
              </p>
            </div>
          </article>

          <article>
            <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
              Missão e valores
            </h2>
            <div className="mt-4 h-0.5 w-12 bg-brand-gradient" aria-hidden="true" />
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
              <p>
                <strong className="font-display font-semibold text-cream">
                  Missão.
                </strong>{" "}
                [TEXTO EDITÁVEL] Ex.: tornar a compra de um seminovo uma decisão
                segura, com informação clara e nenhum custo escondido.
              </p>
              <p>
                <strong className="font-display font-semibold text-cream">
                  Visão.
                </strong>{" "}
                [TEXTO EDITÁVEL] Ex.: ser a revenda mais confiável de{" "}
                {site.region} e região.
              </p>
              <p>
                <strong className="font-display font-semibold text-cream">
                  Valores.
                </strong>{" "}
                [TEXTO EDITÁVEL] Ex.: transparência na negociação, respeito ao
                cliente, cuidado técnico com cada veículo e compromisso com o
                pós-venda.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="px-4 pb-12 sm:px-6 lg:pb-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
            Nossos diferenciais
          </h2>
          <div className="mt-4 h-0.5 w-12 bg-brand-gradient" aria-hidden="true" />
          <ul className="mt-8 grid gap-5 lg:grid-cols-3">
            {DIFERENCIAIS.map(({ Icon, title, text }) => (
              <li key={title} className="border border-white/10 bg-ink p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center bg-brand/10">
                  <Icon className="h-5 w-5 text-brand" />
                </span>
                <h3 className="mt-5 font-display text-base font-semibold text-cream">
                  {title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <TrustBadges />
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/estoque" size="lg">
              Ver estoque completo
            </ButtonLink>
            <WhatsAppButton size="lg" variant="outline">
              Falar com a {site.name}
            </WhatsAppButton>
          </div>
        </div>
      </section>
    </div>
  );
}
