import type { Metadata } from "next";
import { FavoritesList } from "@/components/site/FavoritesList";
import { Container, PageHeader } from "@/components/site/ui";
import { buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";

export const metadata: Metadata = buildPageMetadata({
  title: `Favoritos | ${site.name}`,
  description:
    "Veículos que você salvou para comparar com calma. A lista fica neste aparelho, sem cadastro.",
  path: "/favoritos",
  noIndex: true,
});

export default function FavoritosPage() {
  return (
    <div className="py-12 lg:py-16">
      <Container>
        <PageHeader
          eyebrow="Meus favoritos"
          title="Veículos que você salvou"
          description="Salvos neste aparelho para você comparar com calma. Sem cadastro — se limpar os dados do navegador, a lista some."
        />

        <div className="mt-12">
          <FavoritesList />
        </div>
      </Container>
    </div>
  );
}
