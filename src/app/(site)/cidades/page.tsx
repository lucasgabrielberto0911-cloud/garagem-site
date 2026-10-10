import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { CityDirectory } from "@/components/site/CityDirectory";
import { Container, PageHeader } from "@/components/site/ui";
import { site } from "@/lib/site";
import {
  CITIES_DIRECTORY_PATH,
  breadcrumbJsonLd,
  buildPageMetadata,
} from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Cidades | ${site.name}`,
  description:
    "Escolha a cidade para abrir a página de seminovos da Garagem no Espírito Santo.",
  path: CITIES_DIRECTORY_PATH,
});

export default function CidadesPage() {
  return (
    <div className="py-12 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Cidades", path: CITIES_DIRECTORY_PATH },
        ])}
      />

      <Container>
        <PageHeader
          eyebrow={`${site.state} · loja digital`}
          title="Cidades"
          description="Escolha a cidade para abrir a página de seminovos."
        />

        <nav aria-label="Você está aqui" className="mt-4 text-center text-xs text-muted">
          <Link href="/" className="transition hover:text-cream">
            Início
          </Link>
          <span className="mx-2">/</span>
          <span className="text-cream">Cidades</span>
        </nav>

        <div className="mt-10">
          <CityDirectory />
        </div>
      </Container>
    </div>
  );
}
