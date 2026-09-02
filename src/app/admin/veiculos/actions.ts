"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  copyPublicStorageObject,
  deleteStoragePublicUrls,
  storagePathFromPublicUrl,
} from "@/lib/supabase";
import { normalizeAccessories, parseVehicleCategory } from "@/lib/vehicle-accessories";
import { VEHICLES_PUBLIC_CACHE_TAG } from "@/lib/vehicles";

export type VehicleFormState = {
  error?: string;
  success?: boolean;
};

/** Invalida o cache do site público sempre que o estoque muda. */
function revalidatePublicStock(vehicleId?: string) {
  revalidateTag(VEHICLES_PUBLIC_CACHE_TAG, "max");
  revalidatePath("/");
  revalidatePath("/estoque");
  revalidatePath("/sitemap.xml");
  revalidatePath("/estoque/[id]", "page");
  if (vehicleId) revalidatePath(`/estoque/${vehicleId}`);
}

function requireNumber(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} inválido.`);
  }
  return parsed;
}

function parseVehicleFields(formData: FormData) {
  const category = parseVehicleCategory(String(formData.get("category") || "carro"));
  const brand = String(formData.get("brand") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const version = String(formData.get("version") || "").trim() || null;
  const fuel = String(formData.get("fuel") || "").trim();
  const transmission = String(formData.get("transmission") || "").trim();
  const color = String(formData.get("color") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const engine = String(formData.get("engine") || "").trim() || null;
  const warranty = String(formData.get("warranty") || "").trim() || null;
  const plateRaw = String(formData.get("plate") || "").trim();
  const plate = plateRaw
    ? plateRaw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 7)
    : null;
  const plateEnd = String(formData.get("plateEnd") || "").trim() || null;
  const inspection = String(formData.get("inspection") || "").trim() || null;
  const status = String(formData.get("status") || "disponivel").trim();
  const featured = formData.get("featured") === "on" || formData.get("featured") === "true";
  const year = requireNumber(formData.get("year"), "Ano");
  const yearModel = requireNumber(formData.get("yearModel"), "Ano modelo");
  const km = requireNumber(formData.get("km"), "KM");
  const price = requireNumber(formData.get("price"), "Preço");
  const fipePriceRaw = String(formData.get("fipePrice") || "").trim();
  const fipePrice = fipePriceRaw
    ? (() => {
        const parsed = Number(fipePriceRaw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error("Preço FIPE inválido.");
        }
        return parsed;
      })()
    : null;
  const doorsRaw = String(formData.get("doors") || "").trim();
  const doors = doorsRaw
    ? requireNumber(formData.get("doors"), "Portas")
    : null;

  const purchaseRaw = String(formData.get("purchasePrice") || "").replace(/\D/g, "");
  const purchasePrice = purchaseRaw ? Number(purchaseRaw) : null;
  if (purchasePrice != null && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) {
    throw new Error("Preço de compra inválido.");
  }
  const inStoreName = formData.get("inStoreName") === "on";
  const hasSpareKey = formData.get("hasSpareKey") === "on";
  const hasManual = formData.get("hasManual") === "on";
  const hasVideo =
    formData.get("hasVideo") === "on" || formData.get("hasVideo") === "true";

  if (!brand || !model || !fuel || !transmission) {
    throw new Error("Preencha marca, modelo, combustível e câmbio.");
  }
  if (doors !== null && (doors < 0 || doors > 6)) {
    throw new Error("Portas inválidas.");
  }

  let photos: Array<{ url: string; thumbnailUrl: string | null }> = [];
  const photosRaw = String(formData.get("photoUrls") || "[]");
  try {
    const parsed = JSON.parse(photosRaw) as unknown;
    if (Array.isArray(parsed)) {
      photos = parsed
        .map((item) => {
          if (typeof item === "string" && item) {
            return { url: item, thumbnailUrl: null };
          }
          if (
            item &&
            typeof item === "object" &&
            typeof (item as { url?: unknown }).url === "string"
          ) {
            const url = (item as { url: string }).url;
            const thumbnailUrl =
              typeof (item as { thumbnailUrl?: unknown }).thumbnailUrl === "string"
                ? (item as { thumbnailUrl: string }).thumbnailUrl
                : null;
            return { url, thumbnailUrl };
          }
          return null;
        })
        .filter((item): item is { url: string; thumbnailUrl: string | null } =>
          Boolean(item),
        );
    }
  } catch {
    throw new Error("Fotos inválidas.");
  }

  let accessories: string[] = [];
  const accessoriesRaw = String(formData.get("accessories") || "[]");
  try {
    accessories = normalizeAccessories(JSON.parse(accessoriesRaw));
  } catch {
    throw new Error("Acessórios inválidos.");
  }

  return {
    category,
    brand,
    model,
    version,
    year,
    yearModel,
    km,
    price,
    fipePrice,
    fuel,
    transmission,
    color,
    description,
    engine,
    doors,
    warranty,
    plate,
    plateEnd,
    inspection,
    accessories,
    status,
    featured,
    photos,
    purchasePrice,
    inStoreName,
    hasSpareKey,
    hasManual,
    hasVideo,
  };
}

async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}

export async function createVehicle(
  _prev: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  await requireAdmin();

  try {
    const data = parseVehicleFields(formData);

    const vehicle = await prisma.vehicle.create({
      data: {
        category: data.category,
        brand: data.brand,
        model: data.model,
        version: data.version,
        year: data.year,
        yearModel: data.yearModel,
        km: data.km,
        price: data.price,
        fipePrice: data.fipePrice,
        fuel: data.fuel,
        transmission: data.transmission,
        color: data.color,
        description: data.description,
        engine: data.engine,
        doors: data.doors,
        warranty: data.warranty,
        plate: data.plate,
        plateEnd: data.plateEnd,
        inspection: data.inspection,
        accessories: data.accessories,
        status: data.status,
        featured: data.featured,
        purchasePrice: data.purchasePrice,
        inStoreName: data.inStoreName,
        hasSpareKey: data.hasSpareKey,
        hasManual: data.hasManual,
        hasVideo: data.hasVideo,
        photos: {
          create: data.photos.map((photo, order) => ({
            url: photo.url,
            thumbnailUrl: photo.thumbnailUrl,
            order,
          })),
        },
      },
    });

    revalidatePath("/admin/veiculos");
    revalidatePublicStock(vehicle.id);
    redirect(`/admin/veiculos/${vehicle.id}`);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    console.error(error);
    return {
      error: error instanceof Error ? error.message : "Erro ao criar veículo.",
    };
  }
}

export async function updateVehicle(
  id: string,
  _prev: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  await requireAdmin();

  try {
    const data = parseVehicleFields(formData);

    let previous: Array<{ url: string; thumbnailUrl: string | null }> = [];
    try {
      previous = await prisma.photo.findMany({
        where: { vehicleId: id },
        select: { url: true, thumbnailUrl: true },
      });
    } catch {
      const legacy = await prisma.photo.findMany({
        where: { vehicleId: id },
        select: { url: true },
      });
      previous = legacy.map((photo) => ({ ...photo, thumbnailUrl: null }));
    }

    await prisma.$transaction([
      prisma.photo.deleteMany({ where: { vehicleId: id } }),
      prisma.vehicle.update({
        where: { id },
        data: {
          category: data.category,
          brand: data.brand,
          model: data.model,
          version: data.version,
          year: data.year,
          yearModel: data.yearModel,
          km: data.km,
          price: data.price,
          fipePrice: data.fipePrice,
          fuel: data.fuel,
          transmission: data.transmission,
          color: data.color,
          description: data.description,
          engine: data.engine,
          doors: data.doors,
          warranty: data.warranty,
          plate: data.plate,
          plateEnd: data.plateEnd,
          inspection: data.inspection,
          accessories: data.accessories,
          status: data.status,
          featured: data.featured,
          hasVideo: data.hasVideo,
          photos: {
            create: data.photos.map((photo, order) => ({
              url: photo.url,
              thumbnailUrl: photo.thumbnailUrl,
              order,
            })),
          },
        },
      }),
    ]);

    const kept = new Set(data.photos.map((photo) => photo.url));
    const removed = previous.flatMap((photo) =>
      kept.has(photo.url) ? [] : [photo.url, photo.thumbnailUrl],
    );
    if (removed.length > 0) {
      await deleteStoragePublicUrls(removed);
    }

    revalidatePath("/admin/veiculos");
    revalidatePath(`/admin/veiculos/${id}`);
    revalidatePublicStock(id);
    return { success: true };
  } catch (error) {
    console.error(error);
    return {
      error: error instanceof Error ? error.message : "Erro ao atualizar veículo.",
    };
  }
}

export async function deleteVehicle(id: string) {
  await requireAdmin();

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      photos: { select: { url: true, thumbnailUrl: true } },
      costs: { select: { receiptUrl: true } },
      documents: { select: { fileUrl: true } },
    },
  });

  await prisma.vehicle.delete({ where: { id } });
  await deleteStoragePublicUrls([
    ...(vehicle?.photos.flatMap((photo) => [photo.url, photo.thumbnailUrl]) ?? []),
    ...(vehicle?.costs.map((cost) => cost.receiptUrl) ?? []),
    ...(vehicle?.documents.map((doc) => doc.fileUrl) ?? []),
  ]);

  revalidatePath("/admin/veiculos");
  revalidatePublicStock(id);
  redirect("/admin/veiculos");
}

export async function markVehicleAsSold(id: string) {
  await requireAdmin();

  await prisma.vehicle.update({
    where: { id },
    data: { status: "vendido" },
  });

  revalidatePath("/admin/veiculos");
  revalidatePath(`/admin/veiculos/${id}`);
  revalidatePublicStock(id);
}

const VEHICLE_STATUSES = ["disponivel", "reservado", "vendido"] as const;

export async function setVehicleStatus(id: string, status: string) {
  await requireAdmin();

  if (!(VEHICLE_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, message: "Status inválido." };
  }

  await prisma.vehicle.update({ where: { id }, data: { status } });
  revalidatePath("/admin/veiculos");
  revalidatePath(`/admin/veiculos/${id}`);
  revalidatePublicStock(id);
  return { ok: true, message: "Status atualizado." };
}

export async function setVehicleFeatured(id: string, featured: boolean) {
  await requireAdmin();

  await prisma.vehicle.update({ where: { id }, data: { featured } });
  revalidatePath("/admin/veiculos");
  revalidatePath(`/admin/veiculos/${id}`);
  revalidatePublicStock(id);
  return {
    ok: true,
    message: featured ? "Veículo em destaque." : "Destaque removido.",
  };
}

/**
 * Duplica um anúncio para agilizar o cadastro de veículos parecidos. A cópia
 * nasce como disponível, sem destaque, com fotos novas no Storage — apagar
 * um não quebra o outro.
 */
export async function duplicateVehicle(id: string) {
  await requireAdmin();

  const source = await prisma.vehicle.findUnique({
    where: { id },
    include: { photos: { orderBy: { order: "asc" } } },
  });

  if (!source) {
    return { ok: false as const, message: "Veículo não encontrado." };
  }

  const photos = await duplicateVehiclePhotos(source.photos);

  const copy = await prisma.vehicle.create({
    data: {
      category: source.category,
      brand: source.brand,
      model: source.model,
      version: source.version,
      year: source.year,
      yearModel: source.yearModel,
      km: source.km,
      price: source.price,
      fipePrice: source.fipePrice,
      fuel: source.fuel,
      transmission: source.transmission,
      color: source.color,
      description: source.description,
      engine: source.engine,
      doors: source.doors,
      warranty: source.warranty,
      plate: source.plate,
      plateEnd: source.plateEnd,
      inspection: source.inspection,
      accessories: source.accessories,
      status: "disponivel",
      featured: false,
      inStoreName: source.inStoreName,
      hasSpareKey: source.hasSpareKey,
      hasManual: source.hasManual,
      photos: {
        create: photos.map((photo, order) => ({
          url: photo.url,
          thumbnailUrl: photo.thumbnailUrl,
          order,
        })),
      },
    },
  });

  revalidatePath("/admin/veiculos");
  revalidatePublicStock(copy.id);
  return { ok: true as const, message: "Cópia criada.", id: copy.id };
}

function cardObjectDest(galleryPath: string) {
  return galleryPath.replace(/(\.[a-z0-9]+)?$/i, "-card.webp");
}

async function duplicateVehiclePhotos(
  photos: Array<{ url: string; thumbnailUrl: string | null }>,
) {
  const copied: Array<{ url: string; thumbnailUrl: string | null }> = [];

  for (const photo of photos) {
    const sourcePath = storagePathFromPublicUrl(photo.url);
    if (!sourcePath) {
      copied.push({ url: photo.url, thumbnailUrl: photo.thumbnailUrl });
      continue;
    }

    const ext = sourcePath.match(/\.([a-z0-9]+)$/i)?.[1] ?? "webp";
    const destPath = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const newUrl = await copyPublicStorageObject(photo.url, destPath);

    if (!newUrl) {
      copied.push({ url: photo.url, thumbnailUrl: photo.thumbnailUrl });
      continue;
    }

    let thumbnailUrl: string | null = null;
    if (photo.thumbnailUrl) {
      thumbnailUrl = await copyPublicStorageObject(
        photo.thumbnailUrl,
        cardObjectDest(destPath),
      );
    }
    copied.push({ url: newUrl, thumbnailUrl });
  }

  return copied;
}
