import { notFound, redirect } from "next/navigation";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { AdminPageHeader, Badge } from "@/components/admin/ui";
import { daysInStock } from "@/lib/admin-stats";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; tone: "brand" | "warning" | "neutral" }> = {
  disponivel: { label: "Disponível", tone: "brand" },
  reservado: { label: "Reservado", tone: "warning" },
  vendido: { label: "Vendido", tone: "neutral" },
};

export default async function EditVehiclePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    include: { photos: { orderBy: { order: "asc" } } },
  });

  if (!vehicle) {
    notFound();
  }

  const status = STATUS_LABEL[vehicle.status] ?? {
    label: vehicle.status,
    tone: "neutral" as const,
  };
  const days = daysInStock(vehicle.createdAt);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`${vehicle.brand} ${vehicle.model}`}
        subtitle={`No estoque há ${days} dia(s) · ${vehicle.photos.length} foto(s)`}
        actions={
          <>
            <Badge tone="neutral">{vehicleCategoryLabel(vehicle.category)}</Badge>
            <Badge tone={status.tone}>{status.label}</Badge>
            {vehicle.featured ? <Badge tone="warning">Destaque</Badge> : null}
          </>
        }
      />
      <VehicleForm mode="edit" vehicle={vehicle} />
    </div>
  );
}
