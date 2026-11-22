import Link from "next/link";
import { redirect } from "next/navigation";
import { VehicleImage } from "@/components/VehicleImage";
import { CatalogFeedCopyButton } from "@/components/admin/CatalogFeedCopyButton";
import {
  AdminPageHeader,
  Badge,
  Card,
  StatCard,
} from "@/components/admin/ui";
import { formatAdminMoney } from "@/lib/admin-money";
import { getSession } from "@/lib/auth";
import { CATALOG_IMAGE_SLOTS } from "@/lib/catalog-feed";
import {
  CATALOG_SELECT,
  CATALOG_SELECT_LEGACY,
} from "@/lib/catalog-feed-http";
import { withCatalogColumnFallback } from "@/lib/catalog-feed-query";
import {
  catalogFeedUrl,
  catalogStatusFor,
  type CatalogStatusVehicle,
  type CatalogVehicleStatus,
} from "@/lib/catalog-feed-status";
import { prisma } from "@/lib/prisma";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

type AdminCatalogPhoto = {
  id: string;
  url: string;
  thumbnailUrl: string | null;
};

type AdminCatalogVehicle = CatalogStatusVehicle & {
  photos: AdminCatalogPhoto[];
};

type EvaluatedVehicle = {
  vehicle: AdminCatalogVehicle;
  status: CatalogVehicleStatus;
};

const MAX_PHOTOS_PER_VEHICLE = CATALOG_IMAGE_SLOTS * 3;

function vehicleTitle(vehicle: Pick<AdminCatalogVehicle, "brand" | "model" | "version" | "yearModel">) {
  const base = [vehicle.brand, vehicle.model, vehicle.version]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return vehicle.yearModel > 0 ? `${base} ${vehicle.yearModel}` : base;
}

function vehiclePriceLabel(price: number) {
  return Number.isFinite(price) && price > 0
    ? formatAdminMoney(price)
    : "Sem preço";
}

function reasonBadgeTone(reason: string): "brand" | "neutral" {
  return reason.startsWith("Consignado") ||
    reason === "Sem foto" ||
    reason === "Sem foto pública" ||
    reason === "Sem preço"
    ? "brand"
    : "neutral";
}

export default async function AdminCatalogoPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const vehicles = await withCatalogColumnFallback<AdminCatalogVehicle[]>(
    async (columns) => {
      const rows = await prisma.vehicle.findMany({
        where: { status: { not: "vendido" } },
        orderBy: { updatedAt: "desc" },
        take: 400,
        select: {
          ...(columns.locationCity ? CATALOG_SELECT : CATALOG_SELECT_LEGACY),
          status: true,
          ...(columns.historical ? { historical: true } : {}),
          ...(columns.consigned ? { consigned: true } : {}),
          photos: {
            orderBy: { order: "asc" },
            take: MAX_PHOTOS_PER_VEHICLE,
            select: { id: true, url: true, thumbnailUrl: true },
          },
        },
      });
      return rows.map((row) => ({
        ...row,
        locationCity:
          "locationCity" in row && typeof row.locationCity === "string"
            ? row.locationCity
            : null,
        historical: "historical" in row ? Boolean(row.historical) : false,
        consigned: "consigned" in row ? Boolean(row.consigned) : false,
      }));
    },
  );

  const inCatalog: EvaluatedVehicle[] = [];
  const outOfCatalog: EvaluatedVehicle[] = [];

  for (const vehicle of vehicles) {
    const status = catalogStatusFor(vehicle, site.url);
    if (status.inCatalog) {
      inCatalog.push({ vehicle, status });
    } else {
      outOfCatalog.push({ vehicle, status });
    }
  }

  const feedUrl = catalogFeedUrl(site.url);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Catálogo Meta"
        subtitle="Conferência somente leitura do que o feed CSV envia para a Meta. Consignados nunca entram."
      />

      <section
        aria-label="Resumo do catálogo Meta"
        className="grid grid-cols-2 gap-3 lg:gap-4"
      >
        <StatCard
          label="No catálogo"
          value={inCatalog.length}
          tone="success"
          hint="Publicados no feed CSV"
        />
        <StatCard
          label="Fora do catálogo"
          value={outOfCatalog.length}
          tone="brand"
          hint="Estoque ativo ou consignados fora do feed"
        />
      </section>

      <Card title="Link do feed CSV">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 flex-1 break-all border border-white/15 bg-asphalt px-3 py-2.5 font-mono text-xs text-cream sm:text-sm">
            {feedUrl}
          </p>
          <CatalogFeedCopyButton url={feedUrl} />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Somente leitura do banco da loja. Entram apenas veículos próprios,
          disponíveis, com preço e foto pública. Consignados nunca entram no
          catálogo da Meta, e veículos vendidos ficam fora automaticamente.
        </p>
      </Card>

      <Card
        title={`No catálogo (${inCatalog.length})`}
        action={
          <span className="text-xs text-muted">
            Até {CATALOG_IMAGE_SLOTS} fotos por carro
          </span>
        }
      >
        {inCatalog.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum veículo entra no catálogo neste momento.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {inCatalog.map(({ vehicle, status }) => {
              const cover =
                vehicle.photos[0]?.thumbnailUrl || vehicle.photos[0]?.url || null;
              return (
                <li key={vehicle.id}>
                  <Link
                    prefetch={false}
                    href={`/admin/veiculos/${vehicle.id}`}
                    className="flex min-h-[76px] items-center gap-3 border border-white/15 bg-asphalt/60 p-3 transition touch-manipulation hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="relative h-[60px] w-[80px] shrink-0 overflow-hidden bg-asphalt sm:h-[66px] sm:w-[92px]">
                      <VehicleImage
                        src={cover}
                        alt=""
                        fill
                        sizes="92px"
                        className="object-cover"
                      />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="min-w-0">
                        <span className="block font-display text-sm font-semibold leading-snug text-cream sm:text-base">
                          {vehicleTitle(vehicle)}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {status.feedImageCount}{" "}
                          {status.feedImageCount === 1 ? "foto" : "fotos"} no
                          feed (máx. {CATALOG_IMAGE_SLOTS})
                        </span>
                      </span>
                      <span className="shrink-0 font-display text-sm font-bold tabular-nums text-cream sm:text-base">
                        {vehiclePriceLabel(vehicle.price)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card
        title={`Fora do catálogo (${outOfCatalog.length})`}
        action={
          <span className="text-xs text-muted">Estoque ativo e consignados</span>
        }
      >
        {outOfCatalog.length === 0 ? (
          <p className="text-sm text-muted">
            Todos os veículos do estoque ativo estão no catálogo.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {outOfCatalog.map(({ vehicle, status }) => {
              const cover =
                vehicle.photos[0]?.thumbnailUrl || vehicle.photos[0]?.url || null;
              return (
                <li key={vehicle.id}>
                  <Link
                    prefetch={false}
                    href={`/admin/veiculos/${vehicle.id}`}
                    className="flex min-h-[76px] items-center gap-3 border border-white/15 bg-asphalt/60 p-3 transition touch-manipulation hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    {cover ? (
                      <span className="relative h-[60px] w-[80px] shrink-0 overflow-hidden bg-asphalt sm:h-[66px] sm:w-[92px]">
                        <VehicleImage
                          src={cover}
                          alt=""
                          fill
                          sizes="92px"
                          className="object-cover"
                        />
                      </span>
                    ) : (
                      <span className="flex h-[60px] w-[80px] shrink-0 items-center justify-center border border-white/10 bg-asphalt text-center text-[11px] font-medium text-muted sm:h-[66px] sm:w-[92px]">
                        Sem foto
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="min-w-0">
                        <span className="block font-display text-sm font-semibold leading-snug text-cream sm:text-base">
                          {vehicleTitle(vehicle)}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {status.reasons.map((reason) => (
                            <Badge key={reason} tone={reasonBadgeTone(reason)}>
                              {reason}
                            </Badge>
                          ))}
                        </span>
                      </span>
                      <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-cream/85 sm:text-base">
                        {vehiclePriceLabel(vehicle.price)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
