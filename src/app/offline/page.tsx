import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Sem conexão | ${site.name}`,
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo estático, sem cota /_next/image */}
      <img
        src="/branding/logo-wordmark.webp"
        alt={site.name}
        width={280}
        height={50}
        decoding="async"
        className="h-12 w-auto"
      />
      <div className="mt-8 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
      <h1 className="mt-6 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl">
        Você está sem conexão
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        As páginas que você já visitou continuam disponíveis. Quando a internet
        voltar, o estoque atualiza sozinho.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex min-h-[48px] items-center bg-brand px-6 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418]"
      >
        Tentar novamente
      </Link>
    </div>
  );
}
