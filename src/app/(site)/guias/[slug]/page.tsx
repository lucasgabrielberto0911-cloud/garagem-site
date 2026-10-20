import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Container, PageHeader, ButtonLink, WhatsAppButton } from "@/components/site/ui";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { BUYING_GUIDES } from "@/lib/buying-guides";
import { getCityShowcaseVehicles } from "@/lib/vehicles";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
export const revalidate = 3600;
type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return BUYING_GUIDES.map(guide => ({ slug: guide.slug })); }
export async function generateMetadata({ params }: Props) {
  const slug = (await params).slug;
  const item = BUYING_GUIDES.find(item => item.slug === slug);
  if (!item) return {};
  return buildPageMetadata({ title: `${item.title} | Garagem`, description: item.description, path: `/guias/${item.slug}` });
}
export default async function Page({ params }: Props) {
  const { slug } = await params;
  const guide = BUYING_GUIDES.find(item => item.slug === slug);
  if (!guide) notFound();
  const vehicles = (await getCityShowcaseVehicles()).slice(0, 3);
  return <Container className="py-12">
    <JsonLd data={breadcrumbJsonLd([{ name: "Início", path: "/" }, { name: "Guias de compra", path: "/guias" }, { name: guide.title, path: `/guias/${slug}` }])} />
    <PageHeader eyebrow="Garagem · Espírito Santo" title={guide.title} description={guide.description} />
    <article className="mt-8 max-w-3xl space-y-8">{guide.sections.map(([title, text]) => <section key={title}><h2 className="font-display text-xl">{title}</h2><p className="mt-3 leading-relaxed text-muted">{text}</p></section>)}
      <section><h2 className="font-display text-lg">Fontes e próximos passos</h2><ul className="mt-3">{guide.sources.map(source => <li key={source.url}><a className="inline-flex min-h-11 items-center text-muted underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul><p className="mt-2 text-sm text-muted">Confira as orientações atuais no serviço oficial antes de iniciar o processo.</p></section>
    </article>
    {vehicles.length > 0 && <section className="mt-10"><h2 className="mb-4 font-display text-xl">Opções disponíveis para sua compra</h2><VehicleGrid vehicles={vehicles} returnTo={`/guias/${slug}`} /></section>}
    <div className="mt-8 flex flex-wrap gap-3"><ButtonLink href="/estoque">Ver estoque</ButtonLink><WhatsAppButton trackingLabel="guia" message={`Oi! Li o guia “${guide.title}” no site da Garagem e quero ajuda para escolher um seminovo.`}>Falar no WhatsApp</WhatsAppButton></div>
    <nav aria-label="Outros guias" className="mt-8 grid gap-2">{BUYING_GUIDES.filter(item => item.slug !== slug).map(item => <Link className="inline-flex min-h-11 items-center underline" key={item.slug} href={`/guias/${item.slug}`}>{item.title}</Link>)}</nav>
  </Container>;
}
