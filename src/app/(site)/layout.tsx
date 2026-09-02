import { Suspense } from "react";
import { DeferredMarketing } from "@/components/DeferredMarketing";
import { MetaPixel } from "@/components/MetaPixel";
import { JsonLd } from "@/components/JsonLd";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import { ScrollProgress } from "@/components/site/ScrollProgress";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WhatsAppFloat } from "@/components/site/WhatsAppFloat";
import { FavoritesProvider } from "@/lib/favorites";
import { localBusinessJsonLd } from "@/lib/seo";
import { getPublicSite } from "@/lib/site-settings";

async function SiteJsonLd() {
  const publicSite = await getPublicSite();
  return <JsonLd data={localBusinessJsonLd(publicSite)} />;
}

export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <FavoritesProvider>
      <div className="flex min-h-screen flex-col">
        <MetaPixel />
        <DeferredMarketing />
        <Suspense fallback={null}>
          <SiteJsonLd />
        </Suspense>
        <ScrollProgress />
        <SiteHeader />
        <a
          href="#conteudo"
          className="fixed left-4 top-0 z-[80] -translate-y-full bg-brand px-4 py-3 font-display text-sm font-semibold text-cream outline-none transition focus:translate-y-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
        >
          Pular para o conteúdo
        </a>
        <main id="conteudo" tabIndex={-1} className="flex-1 pt-site-header outline-none">
          {children}
        </main>
        <SiteFooter />
        <div className="pb-site-nav lg:hidden" aria-hidden="true" />
        <MobileBottomNav />
        <WhatsAppFloat />
      </div>
    </FavoritesProvider>
  );
}
