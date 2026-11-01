import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { Container, PageHeader, ButtonLink, WhatsAppButton } from "@/components/site/ui";
import { getStockLandingHistory } from "@/lib/stock-landing-data";
import { canonicalSlugRedirect, stockLandingLinks, stockLandingCopy } from "@/lib/stock-landings";
import { getCityShowcaseVehicles } from "@/lib/vehicles";
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
  return buildPageMetadata({ title: `${link.label} seminovo | Garagem`, description: copy.description, path });
}
export async function StockLanding({ kind, slug }: { kind: "marca" | "modelo"; slug: string }) {
  const { path, link, rows } = await landing(kind, slug);
  const copy = stockLandingCopy(kind, link.label, rows);
  const pedidoHref = wantedVehicleHref({ q: link.label });
  const ids = new Set(rows.filter(row => row.status === "disponivel").map(row => row.id));
  const vehicles = ids.size ? (await getCityShowcaseVehicles()).filter(row => ids.has(row.id)) : [];
  const sold = rows.filter(row => row.status === "vendido");
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
    <section className="mt-8"><h2 className="mb-4 font-display text-xl">Disponíveis agora</h2>
      {vehicles.length ? <VehicleGrid vehicles={vehicles} priorityCount={1} returnTo={path} /> : <p className="text-muted">Nenhum veículo disponível nesta seleção. Registre seu pedido com o modelo preenchido ou fale pelo WhatsApp.</p>}
    </section>
    {sold.length > 0 && <section className="mt-10"><h2 className="font-display text-xl">Já passaram pela Garagem</h2><ul className="mt-4 space-y-3">{sold.map(row => <li key={row.id}><Link className="inline-flex min-h-11 items-center text-muted underline" href={vehiclePath(row)}>{row.brand} {row.model} {row.yearModel} · vendido</Link></li>)}</ul></section>}
    <section className="mt-10"><h2 className="font-display text-xl">Dúvidas rápidas</h2>{faqs.map(faq => <details key={faq.question} className="mt-3 border border-white/10 p-4"><summary className="cursor-pointer font-display">{faq.question}</summary><p className="mt-3 text-muted">{faq.answer}</p></details>)}</section>
    <div className="mt-8 flex flex-wrap gap-3"><ButtonLink href={pedidoHref} variant="outline">Pedir {link.label}</ButtonLink><ButtonLink href="/estoque">Ver estoque</ButtonLink><WhatsAppButton trackingLabel={kind} message={`Oi! Quero saber das opções de ${link.label} na Garagem.`}>Falar no WhatsApp</WhatsAppButton><ButtonLink href="/vender" variant="outline">Vender ou trocar</ButtonLink></div>
    <nav aria-label="Cidades atendidas" className="mt-8 flex flex-wrap gap-x-5">{SERVICE_CITIES.map(city => <Link className="inline-flex min-h-11 items-center text-sm text-muted underline" key={city.slug} href={`/seminovos/${city.slug}`}>{city.name}</Link>)}</nav>
    <Link href="/modelos" className="mt-4 inline-flex min-h-11 items-center underline">Ver marcas e modelos</Link>
  </Container>;
}
