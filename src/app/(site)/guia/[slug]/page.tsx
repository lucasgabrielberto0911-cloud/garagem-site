import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ButtonLink, Container, PageHeader, WhatsAppButton } from "@/components/site/ui";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { SEO_GUIDES, getSeoGuide, pickGuideVehicles } from "@/lib/seo-guides";
import { breadcrumbJsonLd, buildPageMetadata, faqJsonLd } from "@/lib/seo";
import { getCityShowcaseVehicles } from "@/lib/vehicles";

export const revalidate = 3600;
type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SEO_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props) {
  const guide = getSeoGuide((await params).slug);
  if (!guide) return {};
  return buildPageMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guia/${guide.slug}`,
  });
}

export default async function GuiaPage({ params }: Props) {
  const { slug } = await params;
  const guide = getSeoGuide(slug);
  if (!guide) notFound();
  const path = `/guia/${guide.slug}`;
  const vehicles = pickGuideVehicles(await getCityShowcaseVehicles(), guide.models);

  return (
    <Container className="py-12">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Início", path: "/" },
          { name: guide.h1, path },
        ])}
      />
      <JsonLd data={faqJsonLd(guide.faqs.map((f) => ({ question: f.question, answer: f.answer })))} />
      <PageHeader eyebrow="Guia · Garagem" title={guide.h1} description={guide.intro} />

      <article className="mt-8 max-w-3xl space-y-8">
        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-xl font-semibold text-cream">{section.heading}</h2>
            {section.paragraphs.map((text) => (
              <p key={text.slice(0, 40)} className="mt-3 leading-relaxed text-muted">{text}</p>
            ))}
            {section.items ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : null}
          </section>
        ))}
      </article>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-cream">{guide.stockHeading}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{guide.stockIntro}</p>
        <div className="mt-5">
          {vehicles.length > 0 ? (
            <VehicleGrid vehicles={vehicles} returnTo={path} />
          ) : (
            <p className="text-sm text-muted">
              Nenhum desses modelos está disponível agora. <Link className="underline" href="/estoque">Veja o estoque completo</Link>.
            </p>
          )}
        </div>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-display text-xl font-semibold text-cream">Perguntas frequentes</h2>
        <div className="mt-5 space-y-3">
          {guide.faqs.map((item) => (
            <details key={item.question} className="group border border-white/10 bg-ink open:border-brand/40">
              <summary className="cursor-pointer list-none px-4 py-3.5 font-display text-sm font-semibold text-cream marker:content-none">
                {item.question}
              </summary>
              <p className="border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <WhatsAppButton trackingLabel="guia" message={guide.whatsappMessage}>Falar no WhatsApp</WhatsAppButton>
        <ButtonLink href="/estoque" variant="outline">Ver estoque</ButtonLink>
      </div>
      <nav aria-label="Links relacionados" className="mt-8 flex flex-wrap gap-x-5">
        {guide.links.map((link) => (
          <Link key={link.href} className="inline-flex min-h-11 items-center text-sm text-muted underline" href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
    </Container>
  );
}
