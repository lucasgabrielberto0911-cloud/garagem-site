import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { Container, PageHeader } from "@/components/site/ui";
import { getStockLandingHistory } from "@/lib/stock-landing-data";
import { stockLandingLinks } from "@/lib/stock-landings";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
export const revalidate = 3600;
export const metadata = buildPageMetadata({ title: "Marcas e modelos de seminovos | Garagem", description: "Explore o estoque e o histórico público por marca e modelo.", path: "/modelos" });
export default async function Page() {
  const links = stockLandingLinks(await getStockLandingHistory());
  return <Container className="py-12"><JsonLd data={breadcrumbJsonLd([{ name: "Início", path: "/" }, { name: "Marcas e modelos", path: "/modelos" }])} /><PageHeader eyebrow="Garagem · Espírito Santo" title="Marcas e modelos" description="Seleções geradas dos anúncios reais da Garagem, incluindo histórico de vendidos." /><ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{links.map(link => <li key={link.path}><Link className="flex min-h-11 items-center break-words border border-white/10 p-4 font-display" href={link.path}>{link.label}{link.path.startsWith("/marca/") ? " · marca" : ""}</Link></li>)}</ul>{!links.length && <p className="mt-8 text-muted">Nenhuma seleção disponível agora.</p>}</Container>;
}
