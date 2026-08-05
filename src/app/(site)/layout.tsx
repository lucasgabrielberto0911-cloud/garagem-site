import { MobileBottomNav } from "@/components/site/MobileBottomNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";

export default function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {/* Compensa a altura do header fixo. */}
      <main className="flex-1 pt-16 lg:pt-[72px]">{children}</main>
      <SiteFooter />
      {/* Compensa a bottom nav fixa do mobile. */}
      <div className="h-16 lg:hidden" aria-hidden="true" />
      <MobileBottomNav />
    </div>
  );
}
