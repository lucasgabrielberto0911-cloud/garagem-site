import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VehicleForm } from "@/components/admin/VehicleForm";

export default async function EditVehiclePage({
  params,
}: {
  params: { id: string };
}) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    include: { photos: { orderBy: { order: "asc" } } },
  });

  if (!vehicle) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="mb-2 h-1 w-16 bg-brand-gradient" aria-hidden="true" />
        <h1 className="font-display text-3xl font-bold tracking-tight text-cream sm:text-4xl">
          {vehicle.brand} {vehicle.model}
        </h1>
        <p className="mt-1 text-sm text-muted">Editar veículo do estoque</p>
      </div>
      <VehicleForm mode="edit" vehicle={vehicle} />
    </div>
  );
}
