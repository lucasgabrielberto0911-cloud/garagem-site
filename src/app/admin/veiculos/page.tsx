import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { VehiclesTable } from "@/components/admin/VehiclesTable";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const q = (searchParams.q || "").trim();
  const status = (searchParams.status || "").trim();

  const vehicles = await prisma.vehicle.findMany({
    where: {
      AND: [
        status ? { status } : {},
        q
          ? {
              OR: [
                { brand: { contains: q, mode: "insensitive" } },
                { model: { contains: q, mode: "insensitive" } },
                { version: { contains: q, mode: "insensitive" } },
                { color: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
      ],
    },
    include: {
      photos: { orderBy: { order: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 h-1 w-16 bg-brand-gradient" aria-hidden="true" />
          <h1 className="font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
            Veículos
          </h1>
          <p className="mt-1 text-sm text-muted">
            {vehicles.length} veículo{vehicles.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/veiculos/novo"
          className="bg-brand px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418]"
        >
          Novo veículo
        </Link>
      </div>

      <VehiclesTable vehicles={vehicles} q={q} status={status} />
    </div>
  );
}
