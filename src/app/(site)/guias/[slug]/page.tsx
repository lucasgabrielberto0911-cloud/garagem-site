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
      <section><h2 className="font-display text-lg">Fontes e próximos passos</h2><ul className="mt-3 grid gap-2">{guide.sources.map(source => <li key={source.url}><a className="flex min-h-11 items-center justify-between gap-3 border border-white/10 bg-ink px-4 text-sm text-muted transition hover:border-brand hover:text-cream" href={source.url} target="_blank" rel="noopener noreferrer"><span>{source.label}</span><span aria-hidden="true" className="text-brand-light">↗</span></a></li>)}</ul></section>
      <aside className="border border-brand/30 bg-ink p-4 sm:p-5"><p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-light">Dica da Garagem</p><p className="mt-2 text-sm leading-relaxed text-cream">Confira as orientações atuais no serviço oficial antes de iniciar o processo.</p></aside>
    </article>
    {vehicles.length > 0 && <section className="mt-10"><h2 className="mb-4 font-display text-xl">Opções disponíveis para sua compra</h2><VehicleGrid vehicles={vehicles} returnTo={`/guias/${slug}`} /></section>}
    <section className="mt-8 max-w-3xl border border-brand/30 bg-ink p-4 sm:p-5"><h2 className="font-display text-lg text-cream">Dúvida com documento?</h2><p className="mt-1.5 text-sm text-muted">Fale com a gente no WhatsApp e tire a dúvida antes de fechar negócio.</p><div className="mt-4 flex flex-wrap gap-3"><WhatsAppButton trackingLabel="guia" message={`Oi! Li o guia “${guide.title}” no site da Garagem e tenho uma dúvida sobre documentação.`}>Falar no WhatsApp</WhatsAppButton><ButtonLink href="/estoque" variant="outline">Ver estoque</ButtonLink></div></section>
    <nav aria-label="Outros guias" className="mt-8 grid gap-2">{BUYING_GUIDES.filter(item => item.slug !== slug).map(item => <Link className="flex min-h-11 items-center border border-white/10 bg-ink px-4 text-sm text-cream transition hover:border-brand" key={item.slug} href={`/guias/${item.slug}`}>{item.title}</Link>)}</nav>
  </Container>;
}
