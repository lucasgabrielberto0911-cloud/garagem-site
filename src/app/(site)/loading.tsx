import { BrandSplash } from "@/components/site/BrandSplash";

export default function SiteLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] lg:min-h-[calc(100dvh-6.5rem)] items-center justify-center py-16">
      <BrandSplash compact />
    </div>
  );
}
