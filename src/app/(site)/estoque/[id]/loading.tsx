import { Container } from "@/components/site/ui";

export default function VehicleDetailLoading() {
  return (
    <div
      data-ficha-page=""
      className="animate-fade-in pb-sticky-bar-safe lg:pb-10"
    >
      <Container>
        <div className="ficha-mobile-fold lg:hidden">
          <div className="ficha-mobile-photo">
            <div className="gallery-frame skeleton min-h-[9rem] flex-1 border border-white/10" />
          </div>
          <div className="ficha-mobile-sheet px-4 pb-4 pt-4">
            <div className="skeleton h-7 w-4/5" />
            <div className="skeleton mt-2 h-8 w-36" />
            <div className="mt-3.5 grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="border border-white/10 bg-ink px-3 py-2.5">
                  <div className="skeleton h-2.5 w-10" />
                  <div className="skeleton mt-2 h-4 w-16" />
                </div>
              ))}
            </div>
            <div className="skeleton mt-3.5 h-[52px] w-full" />
          </div>
        </div>

        <div className="hidden lg:block">
          <div className="skeleton mx-auto h-3 w-48" />
          <div className="mt-5 grid gap-8 lg:grid-cols-[1.35fr_0.9fr]">
            <div className="skeleton aspect-[16/10] w-full border border-white/10" />
            <div className="flex flex-col border border-white/10 bg-ink p-6">
              <div className="skeleton h-8 w-3/4" />
              <div className="skeleton mt-3 h-4 w-1/2" />
              <div className="skeleton mt-6 h-10 w-48" />
              <div className="mt-6 grid w-full grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="border border-white/10 bg-asphalt px-4 py-3">
                    <div className="skeleton h-2.5 w-16" />
                    <div className="skeleton mt-2 h-4 w-24" />
                  </div>
                ))}
              </div>
              <div className="skeleton mt-6 h-14 w-full" />
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}
