import dynamic from "next/dynamic";
import { Suspense } from "react";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { JsonLd } from "@/components/JsonLd";
import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { localBusinessJsonLd } from "@/lib/seo";
import { getPublicSite } from "@/lib/site-settings";
import { getTestimonials } from "@/lib/vehicles";

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
  // Ambas as leituras são cacheadas (unstable_cache + React cache):
  // na home, o segundo fetch é dedupado com <Testimonials /> — zero query extra.
  const [publicSite, testimonials] = await Promise.all([
    getPublicSite(),
    getTestimonials(6),
  ]);

  // Rich snippet de estrelas apenas com depoimentos reais (ids "seed-" ficam de fora).
  const reviews = testimonials
    .filter((item) => !String(item.id).startsWith("seed-"))
    .map((item) => ({
      name: item.name,
      city: item.city,
      message: item.message,
      rating: item.rating,
    }));

  return (
    <JsonLd data={localBusinessJsonLd(publicSite, reviews)} />
  );
}

export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <GoogleAnalytics />
      <Suspense fallback={null}>
        <SiteJsonLd />
      </Suspense>
      <ScrollProgress />
      <SiteHeader />
      <main className="flex-1 pt-site-header">
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
  );
}
