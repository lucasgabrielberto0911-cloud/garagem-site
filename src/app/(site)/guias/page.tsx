import Link from "next/link";
import { Container, PageHeader } from "@/components/site/ui";
import { BUYING_GUIDES } from "@/lib/buying-guides";
import { buildPageMetadata } from "@/lib/seo";
export const revalidate = 600;
export const metadata = buildPageMetadata({ title: "Guias de compra de seminovos | Garagem", description: "Documentos, cautelar, transferência, recall e visita: guias curtos para sua compra no ES.", path: "/guias" });
export default function Page() {
  return <Container className="py-12"><PageHeader eyebrow="Garagem · Espírito Santo" title="Guias de compra" description="Roteiros curtos para preparar a compra do seu seminovo." /><ul className="mt-8 grid gap-4 sm:grid-cols-2">{BUYING_GUIDES.map(guide => <li key={guide.slug} className="border border-white/10 p-5"><Link className="inline-flex min-h-11 items-center font-display text-lg underline" href={`/guias/${guide.slug}`}>{guide.title}</Link><p className="mt-2 text-muted">{guide.description}</p></li>)}</ul></Container>;
}
