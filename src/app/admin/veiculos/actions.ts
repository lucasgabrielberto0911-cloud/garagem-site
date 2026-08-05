"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export type VehicleFormState = {
  error?: string;
  success?: boolean;
};

function requireNumber(value: FormDataEntryValue | null, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} inválido.`);
  }
  return parsed;
}

function parseVehicleFields(formData: FormData) {
  const brand = String(formData.get("brand") || "").trim();
  const model = String(formData.get("model") || "").trim();
  const version = String(formData.get("version") || "").trim() || null;
  const fuel = String(formData.get("fuel") || "").trim();
  const transmission = String(formData.get("transmission") || "").trim();
  const color = String(formData.get("color") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const status = String(formData.get("status") || "disponivel").trim();
  const featured = formData.get("featured") === "on" || formData.get("featured") === "true";
  const year = requireNumber(formData.get("year"), "Ano");
  const yearModel = requireNumber(formData.get("yearModel"), "Ano modelo");
  const km = requireNumber(formData.get("km"), "KM");
  const price = requireNumber(formData.get("price"), "Preço");

  if (!brand || !model || !fuel || !transmission) {
    throw new Error("Preencha marca, modelo, combustível e câmbio.");
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

  return {
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
        status: data.status,
        featured: data.featured,
        photos: {
          create: data.photoUrls.map((url, order) => ({ url, order })),
        },
      },
    });

    revalidatePath("/admin/veiculos");
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

    await prisma.$transaction([
      prisma.photo.deleteMany({ where: { vehicleId: id } }),
      prisma.vehicle.update({
        where: { id },
        data: {
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
          status: data.status,
          featured: data.featured,
          photos: {
            create: data.photoUrls.map((url, order) => ({ url, order })),
          },
        },
      }),
    ]);

    revalidatePath("/admin/veiculos");
    revalidatePath(`/admin/veiculos/${id}`);
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

  await prisma.vehicle.delete({ where: { id } });
  revalidatePath("/admin/veiculos");
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
  return { ok: true, message: "Status atualizado." };
}

export async function setVehicleFeatured(id: string, featured: boolean) {
  await requireAdmin();

  await prisma.vehicle.update({ where: { id }, data: { featured } });
  revalidatePath("/admin/veiculos");
  revalidatePath(`/admin/veiculos/${id}`);
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
      status: "disponivel",
      featured: false,
      photos: {
        create: source.photos.map((photo, order) => ({ url: photo.url, order })),
      },
    },
  });

  revalidatePath("/admin/veiculos");
  return { ok: true as const, message: "Cópia criada.", id: copy.id };
}
