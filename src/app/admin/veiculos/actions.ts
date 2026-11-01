"use server";

import { legendAccessoriesError, LEGEND_GROUPS } from "@/lib/legend-parser";
import { withAdminStorageLock } from "@/lib/admin-storage-lock";
import { reconcileAdminPhotos } from "@/lib/admin-photo-reconcile";
import type { Prisma } from "@prisma/client";
import { parseVehicleFormFields } from "@/lib/admin-vehicle-fields";
import { deleteUnusedAdminFiles } from "@/lib/admin-file-references";
import { recordAdminAudit } from "@/lib/admin-audit";

import { revalidatePath } from "next/cache";
import { listingDraftFromVehicle } from "@/lib/listing-score";
import { scoreListingAfterSave } from "@/lib/listing-score-store";
import { redirect } from "next/navigation";
import { claimPreparation, preparationPhotoError } from "@/lib/preparation";
import { prisma } from "@/lib/prisma";
import { recordVehiclePriceChange } from "@/lib/vehicle-price-history";
import { getSession } from "@/lib/auth";
import { privateMasterRefForPublicUrl, privatePreviousRefForPublicUrl } from "@/lib/photo-master";
import { replacedThumbnails } from "@/lib/vehicle-photo-files";
import {
  storagePathFromPublicUrl,
} from "@/lib/supabase";
import {
  buildDuplicateDraftPayload,
  DUPLICATE_BACKUP_KEY,
  DUPLICATE_DRAFT_KEY,
  hasDraftContent,
} from "@/lib/admin-duplicate-vehicle";
import {
  normalizeAccessories,
  parseVehicleCategory,
} from "@/lib/vehicle-accessories";
import {
  descriptionPriceSaveError,
  validateVehicleListing,
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
import { formatBrandName, formatModelName } from "@/lib/format";

export type VehicleFormState = {
  error?: string;
  success?: boolean;
  updatedAt?: string;
  id?: string;
  fieldErrors?: Record<string, string>;
};

class VehicleSaleConflictError extends Error {}

/** Chamar após travar os veículos, antes de alterar estoque ou reservas. */
async function assertNoVehicleSales(tx: Prisma.TransactionClient, ids: string[]) {
  const sale = await tx.sale.findFirst({
    where: { vehicleId: { in: ids } },
    select: { id: true },
  });
  if (sale) throw new VehicleSaleConflictError(
    "Cancele a venda em Vendas antes de voltar o veículo para disponível.",
  );
}

/** Só normaliza texto todo em maiúsculas ou minúsculas; "T-Cross" digitado certo fica como está. */
function normalizeCase(value: string, format: (v: string) => string) {
  return value === value.toUpperCase() || value === value.toLowerCase()
    ? format(value)
    : value;
}

function parseVehicleFields(formData: FormData) {
  const category = parseVehicleCategory(
    String(formData.get("category") || "carro"),
  );
  const brandRaw = String(formData.get("brand") || "").trim();
  const brand = normalizeCase(brandRaw, formatBrandName);
  const modelRaw = String(formData.get("model") || "").trim();
  const model = normalizeCase(modelRaw, formatModelName);
  const rawVersion = String(formData.get("version") || "").trim();
  const version = rawVersion
    ? rawVersion.charAt(0).toUpperCase() + rawVersion.slice(1)
    : null;
  const fuel = String(formData.get("fuel") || "").trim();
  const transmission = String(formData.get("transmission") || "").trim();
  const color = String(formData.get("color") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const engine = String(formData.get("engine") || "").trim() || null;
  const warranty = String(formData.get("warranty") || "").trim() || null;
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
  const { year, yearModel, km, doors, price, purchasePrice, plate, fieldErrors } = parseVehicleFormFields(formData);
  if (Object.keys(fieldErrors).length || price == null)
    throw Object.assign(new Error(Object.values(fieldErrors)[0]), { fieldErrors });
  const consigned =
    formData.get("consigned") === "on" || formData.get("consigned") === "true";
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

  const listingIssues = validateVehicleListing({
    brand,
    model,
    fuel,
    transmission,
    color,
    km,
    price,
    locationCity,
  });
  if (listingIssues.length) throw Object.assign(new Error(listingIssues[0].message), {
    fieldErrors: Object.fromEntries(listingIssues.map(({ field, message }) => [field, message])),
  });

  const priceTextError = descriptionPriceSaveError({
    description,
    price,
    status,
  });
  if (priceTextError) throw Object.assign(new Error(priceTextError), { fieldErrors: { description: priceTextError } });

function isValidVehiclePhotoRef(url: string): boolean {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return !trimmed.includes("..");
  }
  return storagePathFromPublicUrl(trimmed) !== null;
}

  let photos: Array<{
    id?: string;
    url: string;
    thumbnailUrl: string | null;
  }> = [];
  const photosRaw = String(formData.get("photoUrls") || "[]");
  try {
    const parsed = JSON.parse(photosRaw) as unknown;
    if (Array.isArray(parsed)) {
      photos = parsed
        .map((item): { id?: string; url: string; thumbnailUrl: string | null } | null => {
          if (typeof item === "string" && item) {
            const trimmed = item.trim();
            if (!isValidVehiclePhotoRef(trimmed)) return null;
            return { url: trimmed, thumbnailUrl: null };
          }
          if (
            item &&
            typeof item === "object" &&
            typeof (item as { url?: unknown }).url === "string"
          ) {
            const rawUrl = (item as { url: string }).url.trim();
            if (!isValidVehiclePhotoRef(rawUrl)) return null;
            const rawThumb =
              typeof (item as { thumbnailUrl?: unknown }).thumbnailUrl ===
              "string"
                ? (item as { thumbnailUrl: string }).thumbnailUrl.trim()
                : null;
            const thumbnailUrl = rawThumb && isValidVehiclePhotoRef(rawThumb) ? rawThumb : null;
            const id = typeof (item as { id?: unknown }).id === "string"
              ? (item as { id: string }).id : undefined;
            return { id, url: rawUrl, thumbnailUrl };
          }
          return null;
        })
        .filter((item): item is { id?: string; url: string; thumbnailUrl: string | null } => item !== null);
    }
  } catch {
    throw new Error("Fotos inválidas.");
  }

  const accessoriesRaw = String(formData.get("accessories") || "[]");
  let rawAccessories: unknown;
  try {
    rawAccessories = JSON.parse(accessoriesRaw);
  } catch {
    throw new Error("Acessórios inválidos.");
  }
  if (Array.isArray(rawAccessories) && rawAccessories.some(item => typeof item === "string" && LEGEND_GROUPS.some(group => item.startsWith(`${group}: `)))) {
    const error = legendAccessoriesError(rawAccessories);
    if (error) throw Object.assign(new Error(error), { fieldErrors: { accessories: error } });
  }
  const accessories = normalizeAccessories(rawAccessories);

  return {
    category,
    brand,
    model,
    version,
    year,
    yearModel,
    km,
    price,
    fuel,
    transmission,
    color,
    description,
    engine,
    doors,
    warranty,
    plate,
    plateEnd: plate ? plate.slice(-1) : plateEnd,
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
    if (data.status === "reservado") {
      return { error: "Use a aba Operação para reservar com cliente, sinal e prazo." };
    }
    await assertCanFeature({ featured: data.featured });
    const preparationId = String(formData.get("preparationId") || "");
    if (preparationId) {
      const photoError = preparationPhotoError(data.photos.length);
      if (photoError) return { error: photoError };
    }

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
      if (preparationId) await claimPreparation(tx, preparationId);
      return created;
    });

    // Anúncio novo conta como alteração. Falha do Jev não afeta o Salvar.
    await scoreListingAfterSave({
      vehicleId: vehicle.id,
      before: null,
      after: listingDraftFromVehicle(vehicle, data.photos.length),
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

export async function updateVehicle(
  id: string,
  _prev: VehicleFormState,
  formData: FormData,
): Promise<VehicleFormState> {
  const session = await requireAdmin();

  try {
    const data = parseVehicleFields(formData);
    await assertCanFeature({ vehicleId: id, featured: data.featured });

    const previousVehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: { id: true, brand: true, model: true, version: true, yearModel: true, locationCity: true },
    });

    const result = await withAdminStorageLock(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
      const current = await tx.vehicle.findUniqueOrThrow({ where: { id } });
      if (data.status === "disponivel") await assertNoVehicleSales(tx, [id]);
      if (data.status === "reservado" && current.status !== "reservado") throw new Error("Use a aba Operação para reservar com cliente, sinal e prazo.");
      if (data.status === "vendido" && current.status !== "vendido" && !(await tx.sale.findUnique({ where: { vehicleId: id }, select: { id: true } }))) throw new Error("Conclua o fluxo de venda para marcar o veículo como vendido.");
      if (current.status === "reservado" && data.status !== "reservado") await tx.vehicleReservation.updateMany({ where: { vehicleId: id, status: { in: data.status === "vendido" ? ["ativa"] : ["ativa", "convertida"] } }, data: { status: data.status === "vendido" ? "convertida" : "cancelada" } });
      const currentPhotos = await tx.photo.findMany({
        where: { vehicleId: id },
        orderBy: { order: "asc" },
        select: { id: true, url: true, thumbnailUrl: true, order: true },
      });
      const photoPlan = reconcileAdminPhotos(currentPhotos, data.photos);
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
            deleteMany: { id: { in: photoPlan.deleteIds } },
            update: photoPlan.update.map(({ id: photoId, ...photo }) => ({
              where: { id: photoId }, data: photo,
            })),
            create: photoPlan.create,
          },
        },
      });
      if (photoPlan.deleteIds.length) {
        // Bancos antigos ainda podem não ter a tabela de informações verificadas.
        const [table] = await tx.$queryRaw<Array<{ present: boolean }>>`
          SELECT to_regclass('"VehicleVerifiedInfo"') IS NOT NULL AS present
        `;
        if (table.present) {
          const verified = await tx.vehicleVerifiedInfo.findUnique({ where: { vehicleId: id } });
          if (verified && Array.isArray(verified.items)) {
            const removedIds = new Set(photoPlan.deleteIds);
            const items = verified.items.map(item => {
              if (!item || typeof item !== "object" || Array.isArray(item) || !Array.isArray(item.photoIds)) return item;
              return { ...item, photoIds: item.photoIds.filter(photoId => typeof photoId !== "string" || !removedIds.has(photoId)) };
            });
            if (JSON.stringify(items) !== JSON.stringify(verified.items)) {
              await tx.vehicleVerifiedInfo.update({
                where: { vehicleId: id }, data: { items: items as Prisma.InputJsonValue },
              });
            }
          }
        }
      }
      await recordAdminAudit(tx, session.adminId, id, "vehicle.update", {
        price: { before: current.price, after: saved.price },
        status: { before: current.status, after: saved.status },
      });
      return { saved, current, currentPhotos };
    });
    // Fora da transação: se a tabela ainda não existir, o Salvar não é afetado.
    await recordVehiclePriceChange(id, result.current.price, result.saved.price);
    const updated = result.saved;

    // Só o Salvar chama o Jev, e só se mudou o que ele lê.
    await scoreListingAfterSave({
      vehicleId: id,
      before: listingDraftFromVehicle(result.current, result.currentPhotos.length),
      after: listingDraftFromVehicle(updated, data.photos.length),
    });

    const kept = new Set(data.photos.map((photo) => photo.url));
    const removed = result.currentPhotos.flatMap((photo) =>
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
    removed.push(...replacedThumbnails(result.currentPhotos, data.photos));
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
    );
    return { success: true, updatedAt: updated.updatedAt.toISOString() };
  } catch (error) {
    console.error(error);
    return {
      updatedAt: _prev.updatedAt,
      error:
        error instanceof Error ? error.message : "Erro ao atualizar veículo.",
      fieldErrors: (error as { fieldErrors?: Record<string, string> })
        .fieldErrors,
    };
  }
}

export async function deleteVehicle(id: string) {
  const session = await requireAdmin();
  const vehicle = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
    const [reservation, document, sale] = await Promise.all([
      tx.vehicleReservation.findFirst({ where: { vehicleId: id }, select: { id: true } }),
      tx.commercialDocument.findFirst({ where: { vehicleId: id }, select: { id: true } }),
      tx.sale.findUnique({ where: { vehicleId: id }, select: { id: true } }),
    ]);
    if (reservation || document || sale) {
      await recordAdminAudit(tx, session.adminId, id, "vehicle.delete.blocked", { reservation: Boolean(reservation), document: Boolean(document), sale: Boolean(sale) });
      return null;
    }
    const row = await tx.vehicle.delete({ where: { id }, include: {
      photos: { select: { url: true, thumbnailUrl: true } },
      costs: { select: { receiptUrl: true } },
      documents: { select: { fileUrl: true } },
    } });
    await recordAdminAudit(tx, session.adminId, id, "vehicle.delete", {});
    return row;
  });
  if (!vehicle) return { ok: false, message: "Este anúncio tem reserva, venda ou documento comercial. Preserve o histórico da operação; ele não pode ser excluído." };
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
    await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
    if (!(await tx.sale.findUnique({ where: { vehicleId: id }, select: { id: true } }))) throw new Error("Conclua o fluxo de venda para marcar o veículo como vendido.");
    await tx.vehicleReservation.updateMany({ where: { vehicleId: id, status: "ativa" }, data: { status: "convertida" } });
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

  if (status === "reservado") return { ok: false, message: "Use a aba Operação para reservar com cliente, sinal e prazo." };

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

  const conflict = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
    if (status === "disponivel") await assertNoVehicleSales(tx, [id]);
    if (status === "vendido" && !(await tx.sale.findUnique({ where: { vehicleId: id }, select: { id: true } }))) throw new VehicleSaleConflictError("Conclua o fluxo de venda para marcar o veículo como vendido.");
    await tx.vehicleReservation.updateMany({ where: { vehicleId: id, status: { in: status === "vendido" ? ["ativa"] : ["ativa", "convertida"] } }, data: { status: status === "vendido" ? "convertida" : "cancelada" } });
    const previous = await tx.vehicle.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    });
    await tx.vehicle.update({
      where: { id },
      data: status === "vendido"
        ? { status, featured: false }
        : { status },
    });
    await recordAdminAudit(tx, session.adminId, id, "vehicle.status", {
      status: { before: previous.status, after: status },
    });
  }).catch((error: unknown) => {
    if (error instanceof VehicleSaleConflictError) return error.message;
    throw error;
  });
  if (conflict) return { ok: false, message: conflict };
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

  if (status === "vendido") return { ok: false, message: "Registre cada venda pelo fluxo de venda antes de marcar os veículos como vendidos." };

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

  const conflict = await prisma.$transaction(async (tx) => {
    for (const id of [...appliedIds].sort()) await tx.$queryRaw`SELECT "id" FROM "Vehicle" WHERE "id" = ${id} FOR UPDATE`;
    if (status === "disponivel") await assertNoVehicleSales(tx, appliedIds);
    const previous = await tx.vehicle.findMany({
      where: { id: { in: appliedIds } },
      select: { id: true, status: true },
    });
    await tx.vehicleReservation.updateMany({ where: { vehicleId: { in: appliedIds }, status: { in: status === "vendido" ? ["ativa"] : ["ativa", "convertida"] } }, data: { status: status === "vendido" ? "convertida" : "cancelada" } });
    await tx.vehicle.updateMany({
      where: { id: { in: appliedIds } },
      data: status === "vendido"
        ? { status, featured: false }
        : { status },
    });
    for (const row of previous)
      await recordAdminAudit(tx, session.adminId, row.id, "vehicle.status", {
        status: { before: row.status, after: status },
        batch: true,
      });
  }).catch((error: unknown) => {
    if (error instanceof VehicleSaleConflictError) return error.message;
    throw error;
  });
  if (conflict) return { ok: false, message: conflict };

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
 * Duplica um anúncio criando um novo rascunho de veículo (E4 / X5).
 * Copia apenas os campos de modelo (marca, modelo, versão, opcionais, legenda)
 * e omite dados específicos (fotos, placa, km, preço, cor).
 * O rascunho fica disponível no fluxo de criação (/admin/veiculos/novo).
 *
 * Protege contra perda de dados: se já existir um rascunho `vehicle:new`
 * com conteúdo preenchido, avisa o usuário antes de substituir.
 * Quando a substituição for confirmada (`replaceDraft: true`), preserva o
 * rascunho anterior como `vehicle:new:backup`.
 */
export async function duplicateVehicle(
  id: string,
  options?: { replaceDraft?: boolean },
) {
  const session = await requireAdmin();

  const source = await prisma.vehicle.findUnique({
    where: { id },
  });

  if (!source) {
    return { ok: false as const, message: "Veículo não encontrado." };
  }

  const payload = buildDuplicateDraftPayload(source);
  const expiresAt = new Date(Date.now() + 30 * 86400000);

  // Leitura + gravação sob o mesmo lock da API de rascunhos: duas abas não se sobrescrevem.
  const blocked = await withAdminStorageLock(async (tx) => {
    const existingDraft = await tx.adminDraft.findUnique({
      where: {
        adminId_key: { adminId: session.adminId, key: DUPLICATE_DRAFT_KEY },
      },
    });

    if (hasDraftContent(existingDraft) && !options?.replaceDraft) return true;

    if (existingDraft && hasDraftContent(existingDraft)) {
      await tx.adminDraft.upsert({
        where: {
          adminId_key: { adminId: session.adminId, key: DUPLICATE_BACKUP_KEY },
        },
        create: {
          adminId: session.adminId,
          key: DUPLICATE_BACKUP_KEY,
          payload: (existingDraft.payload ?? {}) as Prisma.InputJsonValue,
          photoUrls: existingDraft.photoUrls,
          expiresAt: existingDraft.expiresAt,
        },
        update: {
          payload: (existingDraft.payload ?? {}) as Prisma.InputJsonValue,
          photoUrls: existingDraft.photoUrls,
          expiresAt: existingDraft.expiresAt,
          updatedAt: new Date(),
        },
      });
    }

    await tx.adminDraft.upsert({
      where: {
        adminId_key: { adminId: session.adminId, key: DUPLICATE_DRAFT_KEY },
      },
      create: {
        adminId: session.adminId,
        key: DUPLICATE_DRAFT_KEY,
        payload,
        photoUrls: [],
        expiresAt,
      },
      update: { payload, photoUrls: [], expiresAt, updatedAt: new Date() },
    });
    return false;
  });

  if (blocked) {
    return {
      ok: false as const,
      hasExistingDraft: true as const,
      message:
        "Já existe um rascunho de novo veículo em andamento. Deseja substituí-lo pelos dados deste anúncio?",
    };
  }

  revalidatePath("/admin/veiculos");
  return {
    ok: true as const,
    adminId: session.adminId,
    message: "Rascunho criado a partir do anúncio.",
    redirectUrl: "/admin/veiculos/novo",
  };
}
