import type { Metadata } from "next";
import Link from "next/link";
import { SiteWordmark } from "@/components/site/SiteWordmark";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Sem conexão | ${site.name}`,
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <SiteWordmark size="footer" className="justify-center" />
      <div className="mt-8 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
      <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl">
        Você está sem conexão
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        As páginas que você já visitou continuam disponíveis. Pedidos de
        interesse, o formulário de venda e os favoritos ficam guardados neste
        aparelho e são enviados quando a internet voltar.
      </p>
      <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Link
          href="/estoque"
          className="inline-flex min-h-[48px] items-center justify-center bg-brand px-6 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418]"
        >
          Ver estoque
        </Link>
        <Link
          href="/favoritos"
          className="inline-flex min-h-[48px] items-center justify-center border border-white/20 px-6 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:border-brand"
        >
          Meus favoritos
        </Link>
      </div>
      <Link
        href="/"
        className="mt-4 inline-flex min-h-[44px] items-center text-sm text-muted underline-offset-4 hover:text-cream hover:underline"
      >
        Tentar a página inicial
      </Link>
    </div>
  );
}
