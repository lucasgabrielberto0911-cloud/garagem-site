export function VehicleCardSkeleton() {
  return (
    <div className="border border-white/10 bg-ink">
      <div className="skeleton aspect-[4/3] w-full" />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="skeleton mx-auto h-3 w-16" />
        <div className="skeleton mx-auto h-5 w-3/4" />
        <div className="grid grid-cols-2 gap-2">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-full" />
        </div>
        <div className="flex flex-col items-center gap-3 border-t border-white/10 pt-4">
          <div className="skeleton h-7 w-28" />
          <div className="skeleton h-11 w-full" />
        </div>
      </div>
    </div>
  );
}

export function VehicleCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="mx-auto grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <VehicleCardSkeleton key={index} />
      ))}
    </div>
  );
}
