import { Container } from "@/components/site/ui";

export default function VehicleDetailLoading() {
  return (
    <div className="animate-fade-in py-10 pb-sticky-bar-safe lg:py-14 lg:pb-14">
      <Container>
        <div className="skeleton mx-auto h-3 w-48" />

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="skeleton aspect-[16/10] w-full border border-white/10" />
            <div className="mt-2 flex justify-center gap-1.5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="skeleton h-1.5 w-1.5 rounded-full" />
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center border border-white/10 bg-ink p-6">
            <div className="skeleton h-8 w-3/4" />
            <div className="skeleton mt-3 h-4 w-1/2" />
            <div className="skeleton mt-6 h-10 w-48" />
            <div className="mt-6 grid w-full grid-cols-2 gap-px border border-white/10 bg-white/10">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="bg-asphalt px-4 py-3">
                  <div className="skeleton mx-auto h-2.5 w-16" />
                  <div className="skeleton mx-auto mt-2 h-4 w-24" />
                </div>
              ))}
            </div>
            <div className="skeleton mt-6 h-14 w-full" />
            <div className="skeleton mt-3 h-12 w-full" />
          </div>
        </div>
      </Container>
    </div>
  );
}
