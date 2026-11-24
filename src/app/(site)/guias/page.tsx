import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Container, PageHeader } from "@/components/site/ui";
import { BUYING_GUIDES } from "@/lib/buying-guides";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { SEO_GUIDES } from "@/lib/seo-guides";

export const revalidate = 3600;

export const metadata = buildPageMetadata({
  title: "Guias de compra de seminovos | Garagem",
  description:
    "Documentos, cautelar, transferência, recall, visita, financiamento, troca e comparativos: guias curtos para sua compra no ES.",
  path: "/guias",
});

const GUIDES = [
  ...BUYING_GUIDES.map((guide) => ({
    href: `/guias/${guide.slug}`,
    title: guide.title,
    description: guide.description,
  })),
  ...SEO_GUIDES.map((guide) => ({
    href: `/guia/${guide.slug}`,
    title: guide.h1,
    description: guide.description,
  })),
];

export default function Page() {
  return (
    <Container className="py-12">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: "Guias de compra", path: "/guias" },
        ])}
      />
      <PageHeader
        eyebrow="Garagem · Espírito Santo"
        title="Guias de compra"
        description="Roteiros curtos para preparar a compra do seu seminovo."
      />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {GUIDES.map((guide) => (
          <li
            key={guide.href}
            className="border border-white/20 bg-ink p-5 transition hover:border-brand"
          >
            <Link
              className="inline-flex min-h-11 items-center font-display text-lg text-cream hover:text-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              href={guide.href}
            >
              {guide.title}
            </Link>
            <p className="mt-2 text-sm leading-relaxed text-cream/80">
              {guide.description}
            </p>
          </li>
        ))}
      </ul>
    </Container>
  );
}
