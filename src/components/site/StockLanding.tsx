import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { Container, PageHeader, ButtonLink, WhatsAppButton } from "@/components/site/ui";
import { getStockLandingHistory } from "@/lib/stock-landing-data";
import { canonicalSlugRedirect, stockLandingLinks, stockLandingCopy } from "@/lib/stock-landings";
import { getFeaturedVehicles, getVehiclesByIds } from "@/lib/vehicles";
import { WantedVehicleCta } from "@/components/site/WantedVehicleCta";
import { breadcrumbJsonLd, buildPageMetadata, faqJsonLd, itemListJsonLd, SERVICE_CITIES } from "@/lib/seo";
import { site } from "@/lib/site";
import { wantedVehicleHref } from "@/lib/wanted-vehicle-page";
import { vehiclePath } from "@/lib/vehicle-slug";

async function landing(kind: "marca" | "modelo", slug: string) {
  const redirect = canonicalSlugRedirect(kind, slug);
  if (redirect) {
    permanentRedirect(redirect);
  }
  const history = await getStockLandingHistory();
  const path = `/${kind}/${slug}`;
  const link = stockLandingLinks(history).find(item => item.path === path);
  if (!link) notFound();
  const rows = history.filter(row => stockLandingLinks([row]).some(item => item.path === path));
  return { path, link, rows };
}
export async function stockLandingMetadata(kind: "marca" | "modelo", slug: string) {
  const redirect = canonicalSlugRedirect(kind, slug);
  if (redirect) {
    permanentRedirect(redirect);
  }
  const { path, link, rows } = await landing(kind, slug);
  const copy = stockLandingCopy(kind, link.label, rows);
  return buildPageMetadata({
    title: `${link.label} seminovo em Linhares/ES | Garagem`,
    description: `${copy.description} Confira ano, km e preço nas fichas.`,
    path,
    // Sem veículo disponível a página é fraca (só histórico): fora do índice.
    noIndex: !rows.some(row => row.status === "disponivel"),
  });
}
export async function StockLanding({ kind, slug }: { kind: "marca" | "modelo"; slug: string }) {
  const { path, link, rows } = await landing(kind, slug);
  const copy = stockLandingCopy(kind, link.label, rows);
  const pedidoHref = wantedVehicleHref({ q: link.label });
  const ids = new Set(rows.filter(row => row.status === "disponivel").map(row => row.id));
  const vehicles = ids.size ? await getVehiclesByIds([...ids]) : [];
  const sold = rows.filter(row => row.status === "vendido");
  // Sem estoque: mostra "Avise-me" no topo e opções parecidas em destaque.
  const alternatives = vehicles.length ? [] : await getFeaturedVehicles(3);
  const faqs = [
    { question: `Como encontrar ${link.label} na Garagem?`, answer: copy.introduction },
    { question: "Os anúncios vendidos ainda estão à venda?", answer: "Não. O histórico registra veículos que já passaram pela loja, sem preço. Consulte o estoque para ver as opções atuais." },
  ];
  return <Container className="py-12">
    <JsonLd data={breadcrumbJsonLd([{ name: "Início", path: "/" }, { name: "Marcas e modelos", path: "/modelos" }, { name: link.label, path }])} />
    <JsonLd data={faqJsonLd(faqs)} />
    {vehicles.length > 0 && (
      <JsonLd
        data={itemListJsonLd(vehicles, {
          name: `${link.label} seminovo — ${site.name}`,
          path,
        })}
      />
    )}
    <PageHeader eyebrow="Garagem · Espírito Santo" title={`${link.label} seminovo`} description={copy.introduction} />
    {vehicles.length === 0 && <section className="mt-8"><WantedVehicleCta title={`Avise-me quando chegar ${link.label}`} initialWanted={link.label} /></section>}
    <section className="mt-8"><h2 className="mb-4 font-display text-xl">Disponíveis agora</h2>
      {vehicles.length ? <VehicleGrid vehicles={vehicles} priorityCount={1} returnTo={path} /> : <p className="text-muted">Nenhum veículo disponível nesta seleção. Veja opções parecidas abaixo ou fale pelo WhatsApp.</p>}
    </section>
    {alternatives.length > 0 && <section className="mt-10"><h2 className="mb-4 font-display text-xl">Outras opções em destaque</h2><VehicleGrid vehicles={alternatives} returnTo={path} /></section>}
    {sold.length > 0 && <section className="mt-10"><h2 className="font-display text-xl">Já passaram pela Garagem</h2><ul className="mt-4 space-y-3">{sold.map(row => <li key={row.id}><Link className="flex min-h-11 items-center border border-white/10 bg-ink px-4 text-sm text-muted transition hover:border-brand hover:text-cream" href={vehiclePath(row)}>{row.brand} {row.model} {row.yearModel} · vendido</Link></li>)}</ul></section>}
    <section className="mt-10"><h2 className="font-display text-xl">Dúvidas rápidas</h2>{faqs.map(faq => <details key={faq.question} className="mt-3 border border-white/10 p-4"><summary className="cursor-pointer font-display">{faq.question}</summary><p className="mt-3 text-muted">{faq.answer}</p></details>)}</section>
    <div className="mt-8 flex flex-wrap gap-3"><ButtonLink href={pedidoHref} variant="outline">Pedir {link.label}</ButtonLink><ButtonLink href="/estoque">Ver estoque</ButtonLink><WhatsAppButton trackingLabel={kind} message={`Oi! Quero saber das opções de ${link.label} na Garagem.`}>Falar no WhatsApp</WhatsAppButton><ButtonLink href="/vender" variant="outline">Vender ou trocar</ButtonLink></div>
    <nav aria-label="Cidades atendidas" className="mt-8 flex flex-wrap gap-2">{SERVICE_CITIES.map(city => <Link className="inline-flex min-h-11 items-center border border-white/15 px-4 text-sm text-cream transition hover:border-brand" key={city.slug} href={`/seminovos/${city.slug}`}>{city.name}</Link>)}</nav>
    <div className="mt-4"><ButtonLink href="/modelos" variant="outline">Ver marcas e modelos</ButtonLink></div>
  </Container>;
}
