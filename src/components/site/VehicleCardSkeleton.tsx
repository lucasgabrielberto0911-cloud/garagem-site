export function VehicleCardSkeleton({ largePhoto = false }: { largePhoto?: boolean }) {
  return (
    <div className="overflow-hidden border border-white/10 bg-ink">
      <div
        className={`skeleton w-full ${
          largePhoto ? "aspect-[4/3] sm:aspect-[16/10]" : "aspect-[16/10]"
        }`}
      />
      <div className="px-2.5 pb-2 pt-1.5 sm:px-3">
        <div className="skeleton h-5 w-3/4" />
        <div className="mt-1 grid h-[calc(2rem+0.125rem)] grid-rows-2 gap-0.5">
          <div className="grid grid-cols-[minmax(0,1fr)_1.9rem_2.9rem] gap-0.5">
            <div className="border border-white/15" />
            <div className="border border-white/15" />
            <div className="border border-white/15" />
          </div>
          <div className="grid grid-cols-[4.15rem_5.6rem] justify-start gap-0.5">
            <div className="border border-white/15" />
            <div className="border border-white/15" />
          </div>
        </div>
        <div className="skeleton mt-1.5 h-6 w-24" />
        <div className="mt-1.5 h-7 w-full border border-white/20" />
      </div>
    </div>
  );
}

export function VehicleCardSkeletonGrid({
  count = 8,
  largePhoto = false,
}: {
  count?: number;
  largePhoto?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-2 lg:grid-cols-3 ${
        largePhoto
          ? "-mx-2 w-[calc(100%+1rem)] gap-2 sm:mx-0 sm:w-full sm:gap-4"
          : "mx-auto w-full gap-3 sm:gap-4"
      }`}
    >
      {Array.from({ length: count }).map((_, index) => (
        <VehicleCardSkeleton key={index} largePhoto={largePhoto} />
      ))}
    </div>
  );
}
