import { Container } from "@/components/site/ui";

export default function SiteLoading() {
  return (
    <div className="animate-fade-in py-16 lg:py-24" aria-busy="true" aria-live="polite">
      <Container>
        <div className="flex flex-col items-center">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton mt-4 h-10 w-72 max-w-full" />
          <div className="mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
          <div className="skeleton mt-6 h-4 w-full max-w-xl" />
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden border border-white/10 bg-ink">
              <div className="skeleton aspect-[16/10] w-full" />
              <div className="space-y-2 p-3">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton mt-2 h-5 w-24" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}
