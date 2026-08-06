export function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden border border-white/10 bg-ink">
      <div className="skeleton aspect-[16/10] w-full" />
      <div className="space-y-2 p-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-2/3" />
        <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
          <div className="skeleton h-5 w-24" />
          <div className="skeleton h-3 w-16" />
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
