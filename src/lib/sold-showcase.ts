import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  formatBrandName,
  formatModelName,
  formatNumberBR,
  formatVehicleLabel,
} from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { publicPhotoSrc } from "@/lib/public-photo-url";
import {
  formatCustomerVehicleWhatsAppText,
  WHATSAPP_MESSAGES,
  whatsappUrl,
} from "@/lib/site";
import {
  coverMobileSrcSet,
  coverSrc,
  coverSrcSet,
  type VehicleCardPhoto,
} from "@/lib/stock-query";
import { cleanTestimonialField } from "@/lib/testimonials-clean";
import { formatCardVersion, formatVehicleDisplay } from "@/lib/vehicle-display";
import { vehiclePath, vehicleSlug } from "@/lib/vehicle-slug";
import {
  TESTIMONIALS_CACHE_TAG,
  VEHICLES_PUBLIC_CACHE_TAG,
} from "@/lib/vehicles";

export type RawDeliveryTestimonial = {
  id: string;
  name: string;
  city: string | null;
  message: string;
  vehicleLabel: string | null;
  photoUrl: string | null;
  rating: number;
  createdAt: Date | string | null;
};

export type DeliveryShowcaseItem = {
  id: string;
  customerName: string;
  city: string | null;
  vehicleLabel: string | null;
  message: string | null;
  photoSrc: string;
  dateLabel: string | null;
  rating: number;
  whatsappHref: string;
};

export type RawSoldVehicle = {
  id: string;
  category: string;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  yearModel: number;
  km: number;
  transmission: string;
  fuel: string;
  updatedAt: Date | string;
  photos: VehicleCardPhoto[];
};

/** Card público de veículo vendido: nunca inclui preço, placa ou cidade. */
export type SoldVehicleShowcaseItem = {
  id: string;
  path: string;
  brand: string;
  model: string;
  version: string | null;
  title: string;
  yearModel: number;
  kmLabel: string;
  transmission: string;
  cover: string | null;
  srcSet: string | undefined;
  mobileSrcSet: string | undefined;
  whatsappHref: string;
};

export const SOLD_VEHICLE_PUBLIC_SELECT = {
  id: true,
  category: true,
  brand: true,
  model: true,
  version: true,
  year: true,
  yearModel: true,
  km: true,
  transmission: true,
  fuel: true,
  updatedAt: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true, thumbnailUrl: true },
  },
} as const;

const SOLD_VEHICLE_PUBLIC_SELECT_LEGACY = {
  id: true,
  category: true,
  brand: true,
  model: true,
  version: true,
  year: true,
  yearModel: true,
  km: true,
  transmission: true,
  fuel: true,
  updatedAt: true,
  photos: {
    orderBy: { order: "asc" as const },
    take: 1,
    select: { url: true },
  },
} as const;

export function formatDeliveryMonthYear(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

export function buildDeliveryShowcaseItems(
  rows: readonly RawDeliveryTestimonial[],
): DeliveryShowcaseItem[] {
  const items: DeliveryShowcaseItem[] = [];
  for (const row of rows) {
    const rawPhoto = row.photoUrl?.trim();
    if (!rawPhoto) continue;
    const customerName = cleanTestimonialField(row.name) ?? row.name.trim();
    const message = cleanTestimonialField(row.message);
    const vehicleLabel = cleanTestimonialField(row.vehicleLabel);
    const city = cleanTestimonialField(row.city);
    const whatsappText = vehicleLabel
      ? WHATSAPP_MESSAGES.sameBand(vehicleLabel)
      : WHATSAPP_MESSAGES.help;

    items.push({
      id: row.id,
      customerName,
      city,
      vehicleLabel,
      message,
      photoSrc: publicPhotoSrc(rawPhoto),
      dateLabel: formatDeliveryMonthYear(row.createdAt),
      rating: Math.min(5, Math.max(1, Math.round(row.rating || 5))),
      whatsappHref: whatsappUrl(whatsappText, {
        campaign: "home",
        content: `entrega-${row.id}`.slice(0, 80),
      }),
    });
  }
  return items;
}

export function toSoldVehicleShowcaseItem(
  row: RawSoldVehicle,
): SoldVehicleShowcaseItem {
  const display = formatVehicleDisplay({
    id: row.id,
    brand: row.brand,
    model: row.model,
    version: row.version,
    yearModel: row.yearModel,
    transmission: row.transmission,
  });
  const isMoto = row.category === "moto";
  const label = formatVehicleLabel(row.brand, row.model, row.yearModel);
  const slug = vehicleSlug(row);

  return {
    id: row.id,
    path: vehiclePath(row),
    brand: formatBrandName(row.brand),
    model: formatModelName(row.model),
    version: formatCardVersion(row.version, row.model) ?? null,
    title: display.titleWithYear || label,
    yearModel: row.yearModel,
    kmLabel: `${formatNumberBR(row.km)} km`,
    transmission: display.transmission,
    cover: coverSrc(row.photos) ?? null,
    srcSet: coverSrcSet(row.photos),
    mobileSrcSet: coverMobileSrcSet(row.photos),
    whatsappHref: whatsappUrl(
      formatCustomerVehicleWhatsAppText({
        sold: true,
        label: display.fullLabel || label,
        isMoto,
      }),
      { campaign: "estoque", content: slug },
    ),
  };
}

async function fetchDeliveriesWithPhoto(take: number) {
  const rows = await prisma.testimonial.findMany({
    where: {
      published: true,
      photoUrl: { not: null },
    },
    select: {
      id: true,
      name: true,
      city: true,
      message: true,
      vehicleLabel: true,
      photoUrl: true,
      rating: true,
      createdAt: true,
    },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    take,
  });
  return buildDeliveryShowcaseItems(rows);
}

async function fetchSoldVehicles(take: number): Promise<SoldVehicleShowcaseItem[]> {
  try {
    const rows = await prisma.vehicle.findMany({
      where: { status: "vendido", historical: false },
      select: SOLD_VEHICLE_PUBLIC_SELECT,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take,
    });
    return rows.map(toSoldVehicleShowcaseItem);
  } catch (error) {
    if (!isMissingColumnError(error, "thumbnailUrl")) throw error;
    const rows = await prisma.vehicle.findMany({
      where: { status: "vendido", historical: false },
      select: SOLD_VEHICLE_PUBLIC_SELECT_LEGACY,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take,
    });
    return rows.map((row) =>
      toSoldVehicleShowcaseItem({
        ...row,
        photos: row.photos.map((photo) => ({ ...photo, thumbnailUrl: null })),
      }),
    );
  }
}

const loadDeliveriesCached = unstable_cache(
  async (take: number) => fetchDeliveriesWithPhoto(take),
  ["sold-deliveries-v1"],
  { revalidate: 3600, tags: [TESTIMONIALS_CACHE_TAG] },
);

const loadSoldVehiclesCached = unstable_cache(
  async (take: number) => fetchSoldVehicles(take),
  ["sold-vehicles-showcase-v1"],
  { revalidate: 3600, tags: [VEHICLES_PUBLIC_CACHE_TAG] },
);

export const getSoldShowcaseData = cache(
  async (options?: { deliveriesTake?: number; vehiclesTake?: number }) => {
    const deliveriesTake = options?.deliveriesTake ?? 24;
    const vehiclesTake = options?.vehiclesTake ?? 24;
    const [deliveries, vehicles] = await Promise.all([
      loadDeliveriesCached(deliveriesTake).catch((error) => {
        console.error("[vendidos] falha ao carregar entregas:", error);
        return [] as DeliveryShowcaseItem[];
      }),
      loadSoldVehiclesCached(vehiclesTake).catch((error) => {
        console.error("[vendidos] falha ao carregar veículos vendidos:", error);
        return [] as SoldVehicleShowcaseItem[];
      }),
    ]);
    return { deliveries, vehicles };
  },
);
