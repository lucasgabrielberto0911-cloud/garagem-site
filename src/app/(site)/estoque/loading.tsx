import { VehicleCardSkeletonGrid } from "@/components/site/VehicleCardSkeleton";

export default function EstoqueLoading() {
  return (
    <div className="px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton mt-3 h-9 w-72 max-w-full" />
        <div className="mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
        <div className="skeleton mt-5 h-4 w-full max-w-2xl" />

        <div className="mt-8 border border-white/10 bg-ink p-3 sm:p-5">
          <div className="skeleton h-12 w-full" />
          <div className="mt-3 hidden grid-cols-3 gap-3 lg:grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-12 w-full" />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <div className="skeleton h-11 w-28" />
            <div className="skeleton h-11 w-32" />
          </div>
        </div>

        <div className="skeleton mt-6 h-3 w-40" />

        <div className="mt-6">
          <VehicleCardSkeletonGrid count={8} />
        </div>
      </div>
    </div>
  );
}
