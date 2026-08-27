import dynamic from "next/dynamic";
import { Suspense } from "react";
import { DeferredMarketing } from "@/components/DeferredMarketing";
import { JsonLd } from "@/components/JsonLd";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { FavoritesProvider } from "@/lib/favorites";
import { localBusinessJsonLd } from "@/lib/seo";
import { getPublicSite } from "@/lib/site-settings";

const ScrollProgress = dynamic(
  () =>
    import("@/components/site/ScrollProgress").then((m) => m.ScrollProgress),
  { ssr: false },
);
const WhatsAppFloat = dynamic(
  () => import("@/components/site/WhatsAppFloat").then((m) => m.WhatsAppFloat),
  { ssr: false },
);
const BackToTop = dynamic(
  () => import("@/components/site/BackToTop").then((m) => m.BackToTop),
  { ssr: false },
);
const InstallPrompt = dynamic(
  () => import("@/components/site/InstallPrompt").then((m) => m.InstallPrompt),
  { ssr: false },
);
const PwaRegister = dynamic(
  () => import("@/components/site/PwaRegister").then((m) => m.PwaRegister),
  { ssr: false },
);

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
        <BackToTop />
        <InstallPrompt />
        <PwaRegister />
      </div>
    </FavoritesProvider>
  );
}
