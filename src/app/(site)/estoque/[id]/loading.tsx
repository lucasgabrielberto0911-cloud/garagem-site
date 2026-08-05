export default function VehicleDetailLoading() {
  return (
    <div className="px-4 py-10 pb-sticky-bar-safe sm:px-6 lg:py-14 lg:pb-14">
      <div className="mx-auto max-w-7xl">
        <div className="skeleton h-3 w-48" />

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="skeleton aspect-[4/3] w-full border border-white/10" />
            <div className="mt-3 grid grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skeleton aspect-[4/3] w-full" />
              ))}
            </div>
          </div>

          <div className="border border-white/10 bg-ink p-6">
            <div className="skeleton h-8 w-3/4" />
            <div className="skeleton mt-3 h-4 w-1/2" />
            <div className="skeleton mt-6 h-10 w-48" />
            <div className="mt-6 grid grid-cols-2 gap-px border border-white/10 bg-white/10">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="bg-asphalt px-4 py-3">
                  <div className="skeleton h-2.5 w-16" />
                  <div className="skeleton mt-2 h-4 w-24" />
                </div>
              ))}
            </div>
            <div className="skeleton mt-6 h-14 w-full" />
            <div className="skeleton mt-3 h-12 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
