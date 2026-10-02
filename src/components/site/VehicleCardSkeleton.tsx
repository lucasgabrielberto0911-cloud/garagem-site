export function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden border border-white/10 bg-ink">
      <div className="skeleton aspect-[16/10] w-full" />
      <div className="px-2.5 pb-1 sm:px-3">
        <div className="flex h-11 items-center justify-between">
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-4 w-4" />
        </div>
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton mt-1.5 h-3 w-full" />
        <div className="skeleton mt-1 h-3 w-2/3" />
        <div className="skeleton mt-1 h-3 w-4/5" />
        <div className="mt-3 border-t border-white/10 pt-2">
          <div className="skeleton h-7 w-28" />
          <div className="skeleton mx-auto mt-3 h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

export function VehicleCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="mx-auto grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <VehicleCardSkeleton key={index} />
      ))}
    </div>
  );
}
