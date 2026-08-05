import { BackToTop } from "@/components/site/BackToTop";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import { PageTransition } from "@/components/site/PageTransition";
import { ScrollProgress } from "@/components/site/ScrollProgress";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WhatsAppFloat } from "@/components/site/WhatsAppFloat";

export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
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
    </div>
  );
}
