"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function CatalogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[catalog]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center lg:py-28">
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand-light">
        Erro
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-cream">
        Algo deu errado
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        Não conseguimos carregar esta página agora. Tente novamente em instantes.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center bg-brand px-5 font-display text-xs font-semibold uppercase tracking-wide text-cream hover:bg-brand-dark"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center border border-white/15 px-5 font-display text-xs font-semibold uppercase tracking-wide text-cream hover:border-brand"
        >
          Ir ao início
        </Link>
      </div>
    </div>
  );
}
