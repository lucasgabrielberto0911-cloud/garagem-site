import type { Metadata } from "next";
import { FavoritesList } from "@/components/site/FavoritesList";
import { Container, PageHeader } from "@/components/site/ui";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Favoritos | ${site.name}`,
  description:
    "Veículos que você salvou para comparar depois. A lista fica guardada neste aparelho.",
  robots: { index: false, follow: true },
};

export default function FavoritosPage() {
  return (
    <div className="py-12 lg:py-16">
      <Container>
        <PageHeader
          eyebrow="Meus favoritos"
          title="Veículos que você salvou"
          description="A lista fica salva neste aparelho, sem cadastro. Se limpar os dados do navegador, ela é apagada."
        />

        <div className="mt-12">
          <FavoritesList />
        </div>
      </Container>
    </div>
  );
}
