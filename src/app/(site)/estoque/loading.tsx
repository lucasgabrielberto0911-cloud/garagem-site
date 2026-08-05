import { VehicleCardSkeletonGrid } from "@/components/site/VehicleCardSkeleton";
import { Container } from "@/components/site/ui";

export default function EstoqueLoading() {
  return (
    <div className="py-12 lg:py-16">
      <Container>
        <div className="flex flex-col items-center">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton mt-3 h-9 w-72 max-w-full" />
          <div className="mt-4 h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
          <div className="skeleton mt-5 h-4 w-full max-w-2xl" />
        </div>

        <div className="mt-10 border border-white/10 bg-ink p-3 sm:p-5">
          <div className="skeleton mx-auto h-12 w-full max-w-2xl" />
          <div className="mx-auto mt-3 hidden max-w-4xl grid-cols-3 gap-3 lg:grid">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton h-12 w-full" />
            ))}
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <div className="skeleton h-11 w-28" />
            <div className="skeleton h-11 w-32" />
          </div>
        </div>

        <div className="skeleton mx-auto mt-6 h-3 w-40" />

        <div className="mt-6">
          <VehicleCardSkeletonGrid count={8} />
        </div>
      </Container>
    </div>
  );
}
