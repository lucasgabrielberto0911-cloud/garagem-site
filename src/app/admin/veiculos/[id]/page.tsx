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
      sale: { select: { salePrice: true } },
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

      <nav className="grid grid-cols-2 border-b border-white/10">
        <TabLink
          href={`/admin/veiculos/${vehicle.id}`}
          active={view === "anuncio"}
        >
          Anúncio
        </TabLink>
        <TabLink
          href={`/admin/veiculos/${vehicle.id}?view=operacao`}
          active={view === "operacao"}
          mark={!vehicle.purchasePrice}
        >
          Operação
        </TabLink>
      </nav>

      {view === "operacao" ? (
        <VehicleOpsPanel
          vehicle={{
            id: vehicle.id,
            price: vehicle.price,
            salePrice: vehicle.sale?.salePrice ?? null,
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
  mark = false,
  children,
}: {
  href: string;
  active: boolean;
  mark?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`-mb-px inline-flex min-h-[48px] items-center justify-center gap-2 border-b-2 px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition touch-manipulation sm:px-4 ${
        active
          ? "border-brand text-cream"
          : "border-transparent text-muted hover:text-cream"
      }`}
    >
      {children}
      {mark ? (
        <span
          className="h-1.5 w-1.5 bg-brand-orange"
          title="Falta preço de compra"
        />
      ) : null}
    </Link>
  );
}
