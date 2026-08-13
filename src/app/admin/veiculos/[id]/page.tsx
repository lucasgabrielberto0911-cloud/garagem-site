import Link from "next/link";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { VehicleOpsPanel } from "@/components/admin/VehicleOpsPanel";
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

type EditView = "anuncio" | "operacao";

export default async function EditVehiclePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { view?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const view: EditView =
    searchParams.view === "operacao" ? "operacao" : "anuncio";

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: params.id },
    include: {
      photos: { orderBy: { order: "asc" } },
      costs: { orderBy: { incurredAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
    },
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

      <nav className="flex gap-1 border-b border-white/10">
        <TabLink
          href={`/admin/veiculos/${vehicle.id}`}
          active={view === "anuncio"}
        >
          Anúncio
        </TabLink>
        <TabLink
          href={`/admin/veiculos/${vehicle.id}?view=operacao`}
          active={view === "operacao"}
        >
          Operação
        </TabLink>
      </nav>

      {view === "operacao" ? (
        <VehicleOpsPanel
          vehicle={{
            id: vehicle.id,
            price: vehicle.price,
            purchasePrice: vehicle.purchasePrice,
            inStoreName: vehicle.inStoreName,
            hasSpareKey: vehicle.hasSpareKey,
            hasManual: vehicle.hasManual,
          }}
          costs={vehicle.costs}
          documents={vehicle.documents}
        />
      ) : (
        <VehicleForm mode="edit" vehicle={vehicle} />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition ${
        active
          ? "border-brand text-cream"
          : "border-transparent text-muted hover:text-cream"
      }`}
    >
      {children}
    </Link>
  );
}
