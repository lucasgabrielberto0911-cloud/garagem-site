export function VehicleCardSkeleton({ largePhoto = false }: { largePhoto?: boolean }) {
  return (
    <div className="overflow-hidden border border-white/10 bg-ink">
      <div
        className={`skeleton w-full ${
          largePhoto ? "aspect-[4/3] sm:aspect-[16/10]" : "aspect-[16/10]"
        }`}
      />
      <div className="space-y-2 p-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index}>
              <div className="skeleton h-2 w-8" />
              <div className="skeleton mt-1 h-3 w-12" />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-3 w-16" />
        </div>
      </div>
      <div className="skeleton h-11 w-full" />
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
