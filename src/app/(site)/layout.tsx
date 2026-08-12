import dynamic from "next/dynamic";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { JsonLd } from "@/components/JsonLd";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import { PageTransition } from "@/components/site/PageTransition";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
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

export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const publicSite = await getPublicSite();

  return (
    <div className="flex min-h-screen flex-col">
      <GoogleAnalytics />
      <JsonLd data={localBusinessJsonLd(publicSite)} />
      <ScrollProgress />
      <SiteHeader />
      <main className="flex-1 pt-site-header">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
      <div className="pb-site-nav lg:hidden" aria-hidden="true" />
      <MobileBottomNav />
      <WhatsAppFloat />
      <BackToTop />
      <InstallPrompt />
      <PwaRegister />
    </div>
  );
}
