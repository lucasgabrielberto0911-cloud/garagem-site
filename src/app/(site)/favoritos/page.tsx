import type { Metadata } from "next";
import { FavoritesList } from "@/components/site/FavoritesList";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Favoritos | ${site.name}`,
  description:
    "Veículos que você salvou para comparar depois. A lista fica guardada neste aparelho.",
  robots: { index: false, follow: true },
};

export default function FavoritosPage() {
  return (
    <div className="px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-brand">
            Meus favoritos
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
            Veículos que você salvou
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
            A lista fica salva neste aparelho, sem cadastro. Se limpar os dados do
            navegador, ela é apagada.
          </p>
        </header>

        <div className="mt-8">
          <FavoritesList />
        </div>
      </div>
    </div>
  );
}
