"use server";

import { withAdminStorageLock } from "@/lib/admin-storage-lock";
import { parseMoneyBR } from "@/lib/admin-money";
import { vehicleFieldErrors } from "@/lib/admin-vehicle-fields";
import { deleteUnusedAdminFiles } from "@/lib/admin-file-references";
import { recordAdminAudit } from "@/lib/admin-audit";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isMissingColumnError } from "@/lib/prisma-errors";
import { getSession } from "@/lib/auth";
import { privateMasterRefForPublicUrl, privatePreviousRefForPublicUrl } from "@/lib/photo-master";
import { copyPrivateMaster } from "@/lib/photo-master-store";
import { cardObjectPathLike } from "@/lib/cover-frame";
import { replacedThumbnails } from "@/lib/vehicle-photo-files";
import {
  copyPublicStorageObject,
  storagePathFromPublicUrl,
} from "@/lib/supabase";
import {
  normalizeAccessories,
  parseVehicleCategory,
} from "@/lib/vehicle-accessories";
import {
  descriptionPriceSaveError,
  vehicleListingError,
} from "@/lib/admin-vehicle-validate";
import {
  parseVehicleLocationCity,
} from "@/lib/vehicle-location";
import { isAdminBulkStatus, normalizeBulkVehicleIds } from "@/lib/admin-bulk";
import { canEnableFeatured, featuredCapMessage } from "@/lib/featured";
import {
  revalidatePublicStock,
  revalidatePublicStockMany,
} from "@/lib/public-stock-revalidate";

export type VehicleFormState = {
  error?: string;
  success?: boolean;
  updatedAt?: string;
  id?: string;
  fieldErrors?: Record<string, string>;
};

function requireNumber(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} inválido.`);
  }
  return parsed;
}

function parseVehicleFields(formData: FormData) {
  const category = parseVehicleCategory(
    String(formData.get("category") || "carro"),
  );
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
    ? plateRaw
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 7)
    : null;
  const plateEnd = String(formData.get("plateEnd") || "").trim() || null;
  const inspection = String(formData.get("inspection") || "").trim() || null;
  const status = String(formData.get("status") || "disponivel").trim();
  const featuredRequested =
    formData.get("featured") === "on" || formData.get("featured") === "true";
  if (featuredRequested && status === "reservado") {
    throw new Error(
      "Só anúncio disponível entra na home. Marque disponível antes.",
    );
  }
  const featured = featuredRequested && status === "disponivel";
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

  const consigned =
    formData.get("consigned") === "on" || formData.get("consigned") === "true";
  const purchaseRaw = consigned
    ? ""
    : String(formData.get("purchasePrice") || "").trim();
  const purchasePrice = parseMoneyBR(purchaseRaw);
  if (purchaseRaw && purchasePrice == null)
    throw new Error("Preço de compra inválido.");
  if (
    purchasePrice != null &&
    (!Number.isFinite(purchasePrice) || purchasePrice < 0)
  ) {
    throw new Error("Preço de compra inválido.");
  }
  const inStoreName = formData.get("inStoreName") === "on";
  const hasSpareKey = formData.get("hasSpareKey") === "on";
  const hasManual = formData.get("hasManual") === "on";
  const hasVideo =
    formData.get("hasVideo") === "on" || formData.get("hasVideo") === "true";
  const locationRaw = String(formData.get("locationCity") || "").trim();
  const locationCity = parseVehicleLocationCity(locationRaw);
  if (!locationCity) {
    throw Object.assign(new Error("Selecione a cidade onde o veículo está."), {
      fieldErrors: { locationCity: "Selecione a cidade onde o veículo está." },
    });
  }

  if (!brand || !model || !fuel || !transmission) {
    throw new Error("Preencha marca, modelo, combustível e câmbio.");
  }
  const fieldErrors = vehicleFieldErrors({
    year,
    yearModel,
    km,
    status,
    doors,
  });
  if (Object.keys(fieldErrors).length)
    throw Object.assign(new Error(Object.values(fieldErrors)[0]), {
      fieldErrors,
    });
  const listingError = vehicleListingError({
    brand,
    model,
    fuel,
    transmission,
    color,
    km,
    price,
    locationCity,
  });
  if (listingError) throw new Error(listingError);

  const priceTextError = descriptionPriceSaveError({
    description,
    price,
    status,
  });
  if (priceTextError) throw new Error(priceTextError);

  let photos: Array<{
    url: string;
    thumbnailUrl: string | null;
  }> = [];
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
              typeof (item as { thumbnailUrl?: unknown }).thumbnailUrl ===
              "string"
                ? (item as { thumbnailUrl: string }).thumbnailUrl
                : null;
            return { url, thumbnailUrl };
          }
          return null;
        })
        .filter(
          (
            item,
          ): item is {
            url: string;
            thumbnailUrl: string | null;
          } => Boolean(item),
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
    locationCity,
    featured,
    photos,
    purchasePrice,
    consigned,
    inStoreName,
    hasSpareKey,
    hasManual,
    hasVideo,
  };
}

async function assertCanFeature(opts: {
  vehicleId?: string;
  featured: boolean;
}) {
  if (!opts.featured) return;
  const current = opts.vehicleId
    ? await prisma.vehicle.findUnique({
        where: { id: opts.vehicleId },
        select: { featured: true },
      })
    : null;
  const featuredCount = await prisma.vehicle.count({
    where: {
      featured: true,
      status: "disponivel",
      historical: false,
      ...(opts.vehicleId ? { id: { not: opts.vehicleId } } : {}),
    },
  });
  if (!canEnableFeatured(featuredCount, Boolean(current?.featured))) {
    throw new Error(featuredCapMessage());
  }
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
  const session = await requireAdmin();

  try {
    const data = parseVehicleFields(formData);
    await assertCanFeature({ featured: data.featured });

    const vehicle = await withAdminStorageLock(async (tx) => {
      const created = await tx.vehicle.create({
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
          locationCity: data.locationCity,
          featured: data.featured,
          purchasePrice: data.purchasePrice,
          consigned: data.consigned,
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
      await recordAdminAudit(
        tx,
        session.adminId,
        created.id,
        "vehicle.create",
        { price: created.price, status: created.status },
      );
      return created;
    });

    revalidatePath("/admin/veiculos");
    await revalidatePublicStock(vehicle);
    return {
      success: true,
      id: vehicle.id,
      updatedAt: vehicle.updatedAt.toISOString(),
    };
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
      fieldErrors: (error as { fieldErrors?: Record<string, string> })
        .fieldErrors,
    };
  }
}

async function loadPreviousPhotoUrls(vehicleId: string) {
  try {
    return await prisma.photo.findMany({
      where: { vehicleId },
      select: { url: true, thumbnailUrl: true },
    });
  } catch (error) {
    if (!isMissingColumnError(error, "thumbnailUrl")) throw error;
    const legacy = await prisma.photo.findMany({
      where: { vehicleId },
      select: { url: true },
    });
    return legacy.map((photo) => ({
      url: photo.url,
      thumbnailUrl: null as string | null,
    }));
  }
}

export async function updateVehicle(
  id: string,
  _prev: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const session = await requireAdmin();

  try {
    const data = parseVehicleFields(formData);
    await assertCanFeature({ vehicleId: id, featured: data.featured });

    const [previousVehicle, previous] = await Promise.all([
      prisma.vehicle.findUnique({
        where: { id },
        select: {
          id: true,
          brand: true,
          model: true,
          version: true,
          yearModel: true,
          locationCity: true,
        },
      }),
      loadPreviousPhotoUrls(id),
    ]);

    const updated = await withAdminStorageLock(async (tx) => {
      const current = await tx.vehicle.findUniqueOrThrow({ where: { id } });
      const expected = String(formData.get("expectedUpdatedAt") || "");
      if (!expected || current.updatedAt.toISOString() !== expected)
        throw new Error(
          "Este anúncio mudou em outro acesso. Seus campos foram mantidos. Guarde um rascunho e recarregue para comparar antes de salvar.",
        );
      // A condição também protege contra uma alteração concorrente após a leitura.
      const saved = await tx.vehicle.update({
        where: { id, updatedAt: current.updatedAt },
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
          locationCity: data.locationCity,
          featured: data.featured,
          hasVideo: data.hasVideo,
          consigned: data.consigned,
          photos: {
            deleteMany: {},
            create: data.photos.map((photo, order) => ({
              url: photo.url,
              thumbnailUrl: photo.thumbnailUrl,
              order,
            })),
          },
        },
      });
      await recordAdminAudit(tx, session.adminId, id, "vehicle.update", {
        price: { before: current.price, after: saved.price },
        status: { before: current.status, after: saved.status },
      });
      return saved;
    });

    const kept = new Set(data.photos.map((photo) => photo.url));
    const removed = previous.flatMap((photo) =>
      kept.has(photo.url)
        ? []
        : [
            photo.url,
            photo.thumbnailUrl,
            privateMasterRefForPublicUrl(photo.url),
            privatePreviousRefForPublicUrl(photo.url),
          ],
    );
    // Capa reenquadrada: a miniatura antiga da mesma foto também sai.
    removed.push(...replacedThumbnails(previous, data.photos));
    if (removed.length > 0) {
      await deleteUnusedAdminFiles(removed);
    }

    revalidatePath("/admin/veiculos");
    revalidatePath(`/admin/veiculos/${id}`);
    await revalidatePublicStock(
      {
        id,
        brand: data.brand,
        model: data.model,
        version: data.version,
        yearModel: data.yearModel,
      },
      previousVehicle,
      { immediate: previousVehicle?.locationCity !== data.locationCity },
    );
    return { success: true, updatedAt: updated.updatedAt.toISOString() };
  } catch (error) {
    console.error(error);
    return {
      error:
        error instanceof Error ? error.message : "Erro ao atualizar veículo.",
      fieldErrors: (error as { fieldErrors?: Record<string, string> })
        .fieldErrors,
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
  await deleteUnusedAdminFiles([
    ...(vehicle?.photos.flatMap((photo) => [
      photo.url,
      photo.thumbnailUrl,
      privateMasterRefForPublicUrl(photo.url),
      privatePreviousRefForPublicUrl(photo.url),
    ]) ?? []),
    ...(vehicle?.costs.map((cost) => cost.receiptUrl) ?? []),
    ...(vehicle?.documents.map((doc) => doc.fileUrl) ?? []),
  ]);

  revalidatePath("/admin/veiculos");
  await revalidatePublicStock(
    vehicle
      ? {
          id: vehicle.id,
          brand: vehicle.brand,
          model: vehicle.model,
          version: vehicle.version,
          yearModel: vehicle.yearModel,
        }
      : null,
  );
  redirect("/admin/veiculos");
}

export async function markVehicleAsSold(id: string) {
  const session = await requireAdmin();

  await prisma.$transaction(async (tx) => {
    const previous = await tx.vehicle.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    await tx.vehicle.update({
      where: { id },
      data: { status: "vendido", featured: false },
    });
    await recordAdminAudit(tx, session.adminId, id, "vehicle.status", {
      status: { before: previous.status, after: "vendido" },
    });
  });

  revalidatePath("/admin/veiculos");
  revalidatePath(`/admin/veiculos/${id}`);
  await revalidatePublicStock(id);
}

const VEHICLE_STATUSES = ["disponivel", "reservado", "vendido"] as const;

export async function setVehicleStatus(id: string, status: string) {
  const session = await requireAdmin();

  if (!(VEHICLE_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, message: "Status inválido." };
  }

  if (status === "disponivel") {
    const current = await prisma.vehicle.findUnique({
      where: { id },
      select: { description: true, price: true },
    });
    const priceTextError = descriptionPriceSaveError({
      description: current?.description,
      price: current?.price ?? 0,
      status,
    });
    if (priceTextError) return { ok: false, message: priceTextError };
  }

  await prisma.$transaction(async (tx) => {
    const previous = await tx.vehicle.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    await tx.vehicle.update({
      where: { id },
      data: status === "vendido" ? { status, featured: false } : { status },
    });
    await recordAdminAudit(tx, session.adminId, id, "vehicle.status", {
      status: { before: previous.status, after: status },
    });
  });
  revalidatePath("/admin/veiculos");
  revalidatePath(`/admin/veiculos/${id}`);
  await revalidatePublicStock(id);
  return { ok: true, message: "Status atualizado." };
}

export async function setVehiclesStatus(
  ids: string[],
  status: string,
): Promise<{ ok: boolean; message: string; appliedIds?: string[] }> {
  const session = await requireAdmin();

  if (!isAdminBulkStatus(status)) {
    return {
      ok: false,
      message: "Em lote só dá para marcar disponível ou vendido.",
    };
  }

  const unique = normalizeBulkVehicleIds(ids);
  if (unique.length === 0) {
    return { ok: false, message: "Selecione pelo menos um veículo." };
  }

  const rows = await prisma.vehicle.findMany({
    where: { id: { in: unique }, historical: false },
    select: {
      id: true,
      status: true,
      featured: true,
      description: true,
      price: true,
    },
  });
  const priceBlockedIds = new Set(
    status === "disponivel"
      ? rows
          .filter((row) =>
            Boolean(
              descriptionPriceSaveError({
                description: row.description,
                price: row.price,
                status: "disponivel",
              }),
            ),
          )
          .map((row) => row.id)
      : [],
  );
  const appliedIds = rows
    .filter((row) => row.status !== status && !priceBlockedIds.has(row.id))
    .map((row) => row.id);
  if (appliedIds.length === 0) {
    if (priceBlockedIds.size > 0) {
      return {
        ok: false,
        message:
          "A descrição cita um R$ diferente do preço. Corrija a descrição ou o preço antes de voltar para disponível.",
      };
    }
    return {
      ok: false,
      message:
        status === "vendido"
          ? "Esses veículos já estão vendidos."
          : "Esses veículos já estão disponíveis.",
    };
  }

  await prisma.$transaction(async (tx) => {
    const previous = await tx.vehicle.findMany({
      where: { id: { in: appliedIds } },
      select: { id: true, status: true },
    });
    await tx.vehicle.updateMany({
      where: { id: { in: appliedIds } },
      data: status === "vendido" ? { status, featured: false } : { status },
    });
    for (const row of previous)
      await recordAdminAudit(tx, session.adminId, row.id, "vehicle.status", {
        status: { before: row.status, after: status },
        batch: true,
      });
  });

  revalidatePath("/admin/veiculos");
  await revalidatePublicStockMany(appliedIds);
  const priceBlockedCount = priceBlockedIds.size;
  const skipped = unique.length - appliedIds.length - priceBlockedCount;
  const featuredRemoved =
    status === "vendido"
      ? rows.filter((row) => appliedIds.includes(row.id) && row.featured).length
      : 0;
  const home =
    featuredRemoved > 0
      ? ` ${featuredRemoved} saiu${featuredRemoved === 1 ? "" : "ram"} da home.`
      : "";
  const skip =
    skipped > 0
      ? ` ${skipped} já estava${skipped === 1 ? "" : "m"} assim.`
      : "";
  const priceSkip =
    priceBlockedCount > 0
      ? ` ${priceBlockedCount} ficou${priceBlockedCount === 1 ? "" : "ram"} de fora: descrição cita outro preço.`
      : "";
  return {
    ok: true,
    appliedIds,
    message:
      status === "vendido"
        ? `${appliedIds.length} veículo(s) marcados como vendidos. A página pública continua no ar.${home}${skip}`
        : `${appliedIds.length} veículo(s) voltaram para disponível.${skip}${priceSkip}`,
  };
}

export async function setVehicleFeatured(id: string, featured: boolean) {
  await requireAdmin();

  const current = await prisma.vehicle.findUnique({
    where: { id },
    select: { featured: true, status: true, description: true, price: true },
  });
  if (!current) {
    return { ok: false, message: "Veículo não encontrado." };
  }
  if (featured && current.status !== "disponivel") {
    return {
      ok: false,
      message: "Só anúncio disponível entra na home. Marque disponível antes.",
    };
  }
  if (featured) {
    const priceTextError = descriptionPriceSaveError({
      description: current.description,
      price: current.price,
      status: current.status,
    });
    if (priceTextError) return { ok: false, message: priceTextError };
  }
  if (featured && !current.featured) {
    const featuredCount = await prisma.vehicle.count({
      where: { featured: true, status: "disponivel", historical: false },
    });
    if (!canEnableFeatured(featuredCount, current.featured)) {
      return { ok: false, message: featuredCapMessage() };
    }
  }

  await prisma.vehicle.update({ where: { id }, data: { featured } });
  revalidatePath("/admin/veiculos");
  revalidatePath(`/admin/veiculos/${id}`);
  await revalidatePublicStock(id);
  return {
    ok: true,
    message: featured
      ? "Na home (destaque). A ordem é a do cadastro — mais recente primeiro."
      : "Destaque removido da home.",
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
      locationCity: source.locationCity,
      featured: false,
      consigned: source.consigned,
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
  await revalidatePublicStock(copy);
  return { ok: true as const, message: "Cópia criada.", id: copy.id };
}

async function duplicateVehiclePhotos(
  photos: Array<{ url: string; thumbnailUrl: string | null }>,
) {
  const copied: Array<{
    url: string;
    thumbnailUrl: string | null;
  }> = [];

  for (const photo of photos) {
    const sourcePath = storagePathFromPublicUrl(photo.url);
    if (!sourcePath) {
      copied.push({
        url: photo.url,
        thumbnailUrl: photo.thumbnailUrl,
      });
      continue;
    }

    const ext = sourcePath.match(/\.([a-z0-9]+)$/i)?.[1] ?? "webp";
    const destPath = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const newUrl = await copyPublicStorageObject(photo.url, destPath);

    if (!newUrl) {
      copied.push({
        url: photo.url,
        thumbnailUrl: photo.thumbnailUrl,
      });
      continue;
    }

    await copyPrivateMaster(sourcePath, destPath);

    let thumbnailUrl: string | null = null;
    if (photo.thumbnailUrl) {
      thumbnailUrl = await copyPublicStorageObject(
        photo.thumbnailUrl,
        cardObjectPathLike(photo.thumbnailUrl, destPath),
      );
    }
    copied.push({ url: newUrl, thumbnailUrl });
  }

  return copied;
}
