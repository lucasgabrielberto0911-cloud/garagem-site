import { JsonLd } from "@/components/JsonLd";
import { BackToTop } from "@/components/site/BackToTop";
import { InstallPrompt } from "@/components/site/InstallPrompt";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import { PageTransition } from "@/components/site/PageTransition";
import { PwaRegister } from "@/components/site/PwaRegister";
import { ScrollProgress } from "@/components/site/ScrollProgress";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WhatsAppFloat } from "@/components/site/WhatsAppFloat";
import { localBusinessJsonLd } from "@/lib/seo";
import { getPublicSite } from "@/lib/site-settings";

export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const publicSite = await getPublicSite();

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd data={localBusinessJsonLd(publicSite)} />
      <ScrollProgress />
      <SiteHeader />
      <main className="flex-1 pt-[76px] lg:pt-[88px]">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
      {/* Compensa a bottom nav fixa do mobile. */}
      <div className="h-[72px] lg:hidden" aria-hidden="true" />
      <MobileBottomNav />
      <WhatsAppFloat />
      <BackToTop />
      <InstallPrompt />
      <PwaRegister />
    </div>
  );
}
