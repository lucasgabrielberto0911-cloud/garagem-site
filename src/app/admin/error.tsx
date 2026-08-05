"use client";

import Link from "next/link";
import { useEffect } from "react";
import { btn } from "@/components/admin/ui";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center border border-dashed border-white/15 px-6 py-16 text-center">
      <div className="h-1 w-16 bg-brand-gradient" aria-hidden="true" />
      <h1 className="mt-5 font-display text-2xl font-bold text-cream">
        Algo deu errado nesta tela
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
        A operação não pôde ser concluída. Tente novamente — se o erro persistir,
        pode ser a conexão com o banco de dados.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={btn.primary}>
          Tentar novamente
        </button>
        <Link href="/admin" className={btn.outline}>
          Voltar ao dashboard
        </Link>
      </div>
    </div>
  );
}
