import Link from "next/link";
import { CommercialPanel } from "@/components/admin/CommercialPanel";
import type { Prisma } from "@prisma/client";
import { adminDate, reservationDeadline } from "@/lib/admin-date";
import { VehicleTabsLoader } from "@/components/admin/VehicleTabsLoader";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { AdminPageHeader, Badge } from "@/components/admin/ui";
import { daysInStock } from "@/lib/admin-stats";
import { editListingGapLine } from "@/lib/stock-quality";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vehicleCategoryLabel } from "@/lib/vehicle-accessories";
import { vehicleLocationLabel } from "@/lib/vehicle-location";
import { CONSIGNED_LABEL } from "@/lib/vehicle-ops";
import { getAdminVerifiedState } from "@/lib/vehicle-verified-data";
import { getStoredListingScore } from "@/lib/listing-score-store";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<
  string,
  { label: string; tone: "brand" | "warning" | "neutral" }
> = {
  disponivel: { label: "Disponível", tone: "brand" },
  reservado: { label: "Reservado", tone: "warning" },
  vendido: { label: "Vendido", tone: "neutral" },
};

type EditView = "anuncio" | "fotos" | "venda" | "operacao" | "verificado";

export default async function EditVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const [{ id }, { view: viewParam }] = await Promise.all([
    params,
    searchParams,
  ]);
  const view: EditView =
    viewParam === "fotos" ||
    viewParam === "venda" ||
    viewParam === "operacao" ||
    viewParam === "verificado"
      ? viewParam
      : viewParam === "custos"
        ? "operacao"
        : "anuncio";

  // Custos e documentos só nas abas de Custos e docs / Venda — e em paralelo
  // com o veículo, sem esperar a primeira consulta.
  const [vehicle, costs, documents, verified, listingScore] = await Promise.all([
    prisma.vehicle.findUnique({
      where: { id },
      include: {
        photos: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            url: true,
            thumbnailUrl: true,
            order: true,
            vehicleId: true,
          },
        },
        // Preço de venda só entra na aba Custos e docs (Operação).
        ...(view === "operacao" || view === "venda"
          ? { sale: { select: { id: true, salePrice: true, paymentMethod: true, customerId: true, customer: { select: { name: true, cpf: true } } } } }
          : {}),
      },
    }),
    view === "operacao" || view === "venda"
      ? prisma.vehicleCost.findMany({
          where: { vehicleId: id },
          orderBy: { incurredAt: "desc" },
        })
      : Promise.resolve([]),
    view === "operacao"
      ? prisma.vehicleDocument.findMany({
          where: { vehicleId: id },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    // Informações verificadas só na aba própria; sem a tabela, a aba avisa.
    view === "verificado"
      ? getAdminVerifiedState(id)
      : Promise.resolve(null),
    // Nota gravada no último Salvar com alteração. Abrir o admin não chama o Jev.
    view === "anuncio" || view === "fotos"
      ? getStoredListingScore(id)
      : Promise.resolve(null),
  ]);

  if (!vehicle) {
    notFound();
  }

  if (view === "venda") {
    const sale = await prisma.sale.findUnique({ where: { vehicleId: id }, select: { id: true } });
    if (sale) redirect(`/admin/vendas?venda=${sale.id}`);
    redirect(`/admin/vendas/nova?veiculo=${id}`);
  }

  const commercial = view === "operacao" ? await Promise.all([
    prisma.vehicleReservation.findFirst({ where: { vehicleId: id, status: { in: ["ativa", "convertida"] }, ...(vehicle.sale?.customerId ? { customerId: vehicle.sale.customerId } : {}) }, orderBy: { createdAt: "desc" }, include: { customer: { select: { id: true, name: true, phone: true, cpf: true, rg: true, address: true } } } }),
    prisma.vehicleAssessment.findUnique({ where: { vehicleId: id } }),
    prisma.financeSimulation.findMany({ where: { vehicleId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.commercialDocument.findMany({ where: { vehicleId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, kind: true, number: true, createdAt: true, snapshot: true } }),
    prisma.vehiclePriceHistory.findMany({ where: { vehicleId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]) : null;

  const status = STATUS_LABEL[vehicle.status] ?? {
    label: vehicle.status,
    tone: "neutral" as const,
  };
  const days = daysInStock(vehicle.createdAt);
  const gapLine = editListingGapLine({
    status: vehicle.status,
    color: vehicle.color,
    photoCount: vehicle.photos.length,
    price: vehicle.price,
    hasVideo: vehicle.hasVideo,
    version: vehicle.version,
    transmission: vehicle.transmission,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`${vehicle.brand} ${vehicle.model}`}
        subtitle={
          <>
            {`No estoque há ${days} dia(s) · ${vehicle.photos.length} foto(s)`}
            {view === "anuncio" || view === "fotos" ? <span className="mt-1 block">Revise o anúncio em quatro etapas.</span> : null}
            {gapLine ? <span className="mt-1 block">{gapLine}</span> : null}
          </>
        }
        actions={
          <>
            <Badge tone="neutral">
              {vehicleCategoryLabel(vehicle.category)}
            </Badge>
            <Badge tone={status.tone}>{status.label}</Badge>
            <Badge tone={vehicle.locationCity === "serra" ? "info" : "success"}>
              {vehicleLocationLabel(vehicle.locationCity) || "Linhares"}
            </Badge>
            {vehicle.featured ? <Badge tone="warning">Destaque</Badge> : null}
            {vehicle.consigned ? (
              <Badge tone="info">{CONSIGNED_LABEL}</Badge>
            ) : null}
          </>
        }
      />

      <nav
        aria-label="Abas da ficha do veículo"
        className="-mx-3 flex overflow-x-auto border-b border-white/10 px-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-5 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <TabLink
          href={`/admin/veiculos/${vehicle.id}`}
          active={view === "anuncio"}
          tab="anuncio"
        >
          Anúncio
        </TabLink>
        <TabLink
          href={`/admin/veiculos/${vehicle.id}?view=fotos`}
          active={view === "fotos"}
          tab="fotos"
        >
          Fotos
        </TabLink>
        <TabLink
          href={`/admin/vendas/nova?veiculo=${vehicle.id}`}
          active={false}
          tab="venda"
        >
          Iniciar venda
        </TabLink>
        <TabLink
          href={`/admin/veiculos/${vehicle.id}?view=operacao`}
          active={view === "operacao"}
          mark={!vehicle.purchasePrice && !vehicle.consigned}
          tab="operacao"
        >
          Custos e docs
        </TabLink>
        <TabLink
          href={`/admin/veiculos/${vehicle.id}?view=verificado`}
          active={view === "verificado"}
          tab="verificado"
        >
          Verificado
        </TabLink>
      </nav>

      {view === "operacao" && commercial ? <CommercialPanel
          vehicle={{ id, chassis: vehicle.chassis, renavam: vehicle.renavam, status: vehicle.status, price: vehicle.price, purchasePrice: vehicle.purchasePrice, consigned: vehicle.consigned, days, costs: costs.reduce((sum, cost) => sum + cost.amount, 0), sale: vehicle.sale }}
          reservation={commercial[0] ? { customerId: commercial[0].customer.id, customer: commercial[0].customer.name, phone: commercial[0].customer.phone, deposit: Number(commercial[0].deposit), expiresAt: commercial[0].expiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }), deadline: commercial[0].status === "ativa" ? reservationDeadline(commercial[0].expiresAt) : null, status: commercial[0].status } : null}
          assessment={commercial[1] ? { items: commercial[1].items as Prisma.JsonArray as { label: string; status: string }[], notes: commercial[1].notes, offer: Number(commercial[1].offer), approved: commercial[1].approved } : null}
          simulations={commercial[2].map((s) => ({ id: s.id, customerName: s.customerName, bank: s.bank, installment: Number(s.installment), months: s.months, rate: Number(s.rate), status: s.status }))}
          documents={commercial[3].map((d) => { const snapshot = d.snapshot as { saleId?: string | null; customerId?: string | null; customer?: string; cpf?: string; conditions?: string; signal?: { amount?: number; receiptId?: string; date?: string }; payments?: { method: string; amount: number; bank?: string; installmentAmount?: number; tradeVehicle?: string; tradePlate?: string; installments?: number; downPayment?: number }[] } | null; return { id: d.id, kind: d.kind, number: d.number, date: adminDate(d.createdAt), saleId: snapshot?.saleId, customerId: snapshot?.customerId, customer: snapshot?.customer, cpf: snapshot?.cpf, conditions: snapshot?.conditions, signal: snapshot?.signal, payments: snapshot?.payments }; })}
          history={commercial[4].map((h) => ({ price: h.price, date: adminDate(h.createdAt) }))}
        /> : null}
      {view === "verificado" && verified ? (
        <VehicleTabsLoader view="verificado" panelProps={{
          vehicleId: vehicle.id,
          isMoto: vehicle.category === "moto",
          photos: vehicle.photos.map(({ id, url, thumbnailUrl }) => ({ id, url, thumbnailUrl })),
          items: verified.available ? verified.items : [],
          unavailable: verified.available ? undefined : verified.reason,
        }} />
      ) : view === "operacao" ? (
        <VehicleTabsLoader view="operacao" panelProps={{
          vehicle: {
            id: vehicle.id, price: vehicle.price, salePrice: vehicle.sale?.salePrice ?? null,
            purchasePrice: vehicle.purchasePrice, consigned: vehicle.consigned,
            inStoreName: vehicle.inStoreName, hasSpareKey: vehicle.hasSpareKey, hasManual: vehicle.hasManual,
          },
          photos: vehicle.photos.map(({ id, url, thumbnailUrl }) => ({ id, url, thumbnailUrl })),
          costs, documents,
        }} />
      ) : (
        <VehicleTabsLoader view="anuncio" panelProps={{
          layout: "wizard",
          mode: "edit",
          vehicle,
          adminId: session.adminId,
          listingScore,
          initialTab: view === "fotos" ? "fotos" : "anuncio",
        }} />
      )}
    </div>
  );
}

function TabLink({
  href,
  active,
  mark = false,
  tab,
  children,
}: {
  href: string;
  active: boolean;
  mark?: boolean;
  tab: EditView;
  children: ReactNode;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      data-vehicle-tab={tab}
      aria-current={active ? "page" : undefined}
      className={`-mb-px inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-wider transition touch-manipulation sm:px-4 ${
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
