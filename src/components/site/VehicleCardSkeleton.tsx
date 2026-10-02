export function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[0.875rem] border border-white/10 bg-ink">
      <div className="skeleton aspect-[4/3] w-full" />
      <div className="space-y-2.5 px-2.5 py-3 lg:px-4">
        <div className="skeleton h-3 w-12" />
        <div className="skeleton h-6 w-3/4" />
        <div className="skeleton h-8 w-full" />
        <div className="grid grid-cols-2 gap-1">
          <div className="skeleton h-6" />
          <div className="skeleton h-6" />
        </div>
        <div className="skeleton h-6 w-full" />
        <div className="skeleton h-3 w-12" />
        <div className="skeleton h-7 w-3/4" />
      </div>
      <div className="h-11 border-t border-white/10 bg-[#14231b]" />
    </div>
  );
}

export function VehicleCardSkeletonGrid({ count = 8 }: { count?: number; largePhoto?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-2.5 gap-y-3.5 lg:grid-cols-3 lg:gap-x-3">
      {Array.from({ length: count }).map((_, index) => (
        <VehicleCardSkeleton key={index} />
      ))}
    </div>
  );
}
