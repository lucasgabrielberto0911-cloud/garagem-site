"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  VEHICLE_PHOTOS_BUCKET,
  getSupabaseAdmin,
  storagePathFromPublicUrl,
} from "@/lib/supabase";
import { normalizeAccessories, parseVehicleCategory } from "@/lib/vehicle-accessories";

export type VehicleFormState = {
  error?: string;
  success?: boolean;
};

/** Invalida o cache do site público sempre que o estoque muda. */
function revalidatePublicStock(vehicleId?: string) {
  revalidatePath("/");
  revalidatePath("/estoque");
  revalidatePath("/sitemap.xml");
  revalidatePath("/estoque/[id]", "page");
  if (vehicleId) revalidatePath(`/estoque/${vehicleId}`);
}

async function deleteStoragePhotos(urls: string[]) {
  const paths = urls
    .map(storagePathFromPublicUrl)
    .filter((path): path is string => Boolean(path));
  if (paths.length === 0) return;

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage
      .from(VEHICLE_PHOTOS_BUCKET)
      .remove(paths);
    if (error) console.error("[storage] falha ao remover fotos:", error);
  } catch (error) {
    console.error("[storage] falha ao remover fotos:", error);
  }
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
  const plateEnd = String(formData.get("plateEnd") || "").trim() || null;
  const inspection = String(formData.get("inspection") || "").trim() || null;
  const status = String(formData.get("status") || "disponivel").trim();
  const featured = formData.get("featured") === "on" || formData.get("featured") === "true";
  const year = requireNumber(formData.get("year"), "Ano");
  const yearModel = requireNumber(formData.get("yearModel"), "Ano modelo");
  const km = requireNumber(formData.get("km"), "KM");
  const price = requireNumber(formData.get("price"), "Preço");
  const doorsRaw = String(formData.get("doors") || "").trim();
  const doors = doorsRaw
    ? requireNumber(formData.get("doors"), "Portas")
    : null;

  if (!brand || !model || !fuel || !transmission) {
    throw new Error("Preencha marca, modelo, combustível e câmbio.");
  }
  if (doors !== null && (doors < 0 || doors > 6)) {
    throw new Error("Portas inválidas.");
  }

  let photoUrls: string[] = [];
  const photosRaw = String(formData.get("photoUrls") || "[]");
  try {
    const parsed = JSON.parse(photosRaw);
    if (Array.isArray(parsed)) {
      photoUrls = parsed.filter((url): url is string => typeof url === "string");
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
    fuel,
    transmission,
    color,
    description,
    engine,
    doors,
    warranty,
    plateEnd,
    inspection,
    accessories,
    status,
    featured,
    photoUrls,
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
        fuel: data.fuel,
        transmission: data.transmission,
        color: data.color,
        description: data.description,
        engine: data.engine,
        doors: data.doors,
        warranty: data.warranty,
        plateEnd: data.plateEnd,
        inspection: data.inspection,
        accessories: data.accessories,
        status: data.status,
        featured: data.featured,
        photos: {
          create: data.photoUrls.map((url, order) => ({ url, order })),
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

    const previous = await prisma.photo.findMany({
      where: { vehicleId: id },
      select: { url: true },
    });

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
          fuel: data.fuel,
          transmission: data.transmission,
          color: data.color,
          description: data.description,
          engine: data.engine,
          doors: data.doors,
          warranty: data.warranty,
          plateEnd: data.plateEnd,
          inspection: data.inspection,
          accessories: data.accessories,
          status: data.status,
          featured: data.featured,
          photos: {
            create: data.photoUrls.map((url, order) => ({ url, order })),
          },
        },
      }),
    ]);

    const kept = new Set(data.photoUrls);
    const removed = previous
      .map((photo) => photo.url)
      .filter((url) => !kept.has(url));
    if (removed.length > 0) {
      await deleteStoragePhotos(removed);
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

  const photos = await prisma.photo.findMany({
    where: { vehicleId: id },
    select: { url: true },
  });

  await prisma.vehicle.delete({ where: { id } });
  await deleteStoragePhotos(photos.map((photo) => photo.url));

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
 * nasce como disponível, sem destaque e com as mesmas fotos.
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
      fuel: source.fuel,
      transmission: source.transmission,
      color: source.color,
      description: source.description,
      engine: source.engine,
      doors: source.doors,
      warranty: source.warranty,
      plateEnd: source.plateEnd,
      inspection: source.inspection,
      accessories: source.accessories,
      status: "disponivel",
      featured: false,
      photos: {
        create: source.photos.map((photo, order) => ({ url: photo.url, order })),
      },
    },
  });

  revalidatePath("/admin/veiculos");
  revalidatePublicStock(copy.id);
  return { ok: true as const, message: "Cópia criada.", id: copy.id };
}
