import { BrandSplash } from "@/components/site/BrandSplash";

export default function SiteLoading() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center py-16">
      <BrandSplash compact label="Carregando…" />
    </div>
  );
}
