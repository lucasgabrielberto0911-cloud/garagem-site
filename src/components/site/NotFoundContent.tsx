import Link from "next/link";
import { ActionRow, ButtonLink, Container, WhatsAppButton } from "@/components/site/ui";

export function NotFoundContent() {
  return (
    <Container size="text" className="py-20 text-center lg:py-28">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand-light">
        Erro 404
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
        Página não encontrada
      </h1>
      <div className="mx-auto mt-5 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
      <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted">
        O link que você tentou acessar não existe, foi alterado ou o veículo já foi vendido.
        Veja as opções disponíveis no nosso estoque ou fale com a nossa equipe.
      </p>
      <ActionRow className="mt-9">
        <ButtonLink href="/estoque" size="lg">
          Ver estoque
        </ButtonLink>
        <WhatsAppButton size="lg" variant="outline" trackingLabel="404">
          Falar no WhatsApp
        </WhatsAppButton>
      </ActionRow>
      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center font-display text-sm font-semibold text-muted transition hover:text-cream underline-offset-4 hover:underline touch-manipulation"
        >
          ← Voltar para o Início
        </Link>
      </div>
    </Container>
  );
}
