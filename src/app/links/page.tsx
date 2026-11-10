import type { Metadata } from "next";
import Link from "next/link";
import { LinksHub } from "@/components/site/LinksHub";
import { SiteWordmark } from "@/components/site/SiteWordmark";
import { buildPageMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { getSiteContent } from "@/lib/site-content";
import { publicSiteLinks } from "@/lib/site-links";

// O painel invalida na hora (updateTag + revalidatePath em /admin/site).
export const revalidate = 3600;

export const metadata: Metadata = buildPageMetadata({
  title: `Links da ${site.name}`,
  description: `Estoque, WhatsApp e redes da ${site.name} em um só lugar.`,
  path: "/links",
});

export default async function LinksPage() {
  const { links } = await getSiteContent();

  return (
    <>
      <header className="mb-8 flex flex-col items-center text-center">
        <Link
          href="/"
          aria-label={`${site.name} — ir para o início do site`}
          className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-4 focus-visible:ring-offset-asphalt"
        >
          <SiteWordmark size="hero" priority />
        </Link>
        <h1 className="mt-5 font-display text-2xl font-bold text-cream">
          {site.name}
        </h1>
        <span
          aria-hidden="true"
          className="mt-3 h-0.5 w-12 rounded-full bg-brand-gradient"
        />
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Seminovos com procedência no norte do ES.
        </p>
      </header>

      <LinksHub links={publicSiteLinks(links)} />
    </>
  );
}
