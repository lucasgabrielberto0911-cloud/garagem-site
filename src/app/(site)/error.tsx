"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ActionRow, ButtonLink, Container, WhatsAppButton } from "@/components/site/ui";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[site]", error);
  }, [error]);

  return (
    <Container size="text" className="py-20 text-center lg:py-28">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
        Erro
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
        Algo deu errado
      </h1>
      <div className="mx-auto mt-5 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
      <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-muted">
        Não conseguimos carregar esta página agora. Tente de novo — se o problema
        continuar, fale conosco no WhatsApp.
      </p>
      <ActionRow className="mt-9">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center gap-2 bg-brand px-6 py-3.5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418]"
        >
          Tentar novamente
        </button>
        <ButtonLink href="/" size="lg" variant="outline">
          Ir ao início
        </ButtonLink>
        <WhatsAppButton size="lg" variant="outline">
          WhatsApp
        </WhatsAppButton>
      </ActionRow>
      <p className="mt-6 text-xs text-muted">
        Ou veja o{" "}
        <Link href="/estoque" className="text-cream underline-offset-2 hover:underline">
          estoque
        </Link>
        .
      </p>
    </Container>
  );
}
