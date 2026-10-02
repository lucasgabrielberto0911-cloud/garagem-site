export function VehicleCardSkeleton({ largePhoto = false }: { largePhoto?: boolean }) {
  return (
    <div className="overflow-hidden border border-white/10 bg-ink">
      <div
        className={`skeleton w-full ${
          largePhoto ? "aspect-[4/3] sm:aspect-[16/10]" : "aspect-[16/10]"
        }`}
      />
      <div className="space-y-2 px-2.5 pb-2 pt-2.5 sm:px-3.5 sm:pt-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-3 w-16" />
          ))}
        </div>
        <div className="border-t border-white/10 pt-2.5">
          <div className="skeleton h-7 w-28" />
          <div className="mt-2 flex items-center justify-between">
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-11 w-11" />
          </div>
        </div>
      </div>
      {largePhoto ? null : <div className="skeleton h-11 w-full" />}
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
