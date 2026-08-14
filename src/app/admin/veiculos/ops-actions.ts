"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteStoragePublicUrls, isInternalAdminFileUrl } from "@/lib/supabase";
import {
  docKindLabel,
  isCostKind,
  isDocKind,
  isOtherKind,
} from "@/lib/vehicle-ops";

export type OpsActionState = {
  ok: boolean;
  message: string;
};

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
}

function digitsOnly(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "");
}

function revalidateVehicle(id: string) {
  revalidatePath("/admin/veiculos");
  revalidatePath(`/admin/veiculos/${id}`);
}

export async function updateVehicleOps(
  vehicleId: string,
  formData: FormData,
): Promise<OpsActionState> {
  await requireAdmin();

  const purchaseRaw = digitsOnly(formData.get("purchasePrice"));
  const purchasePrice = purchaseRaw ? Number(purchaseRaw) : null;
  if (purchasePrice != null && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) {
    return { ok: false, message: "Preço de compra inválido." };
  }

  try {
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        inStoreName: formData.get("inStoreName") === "on",
        hasSpareKey: formData.get("hasSpareKey") === "on",
        hasManual: formData.get("hasManual") === "on",
        purchasePrice,
      },
    });
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível salvar a operação." };
  }

  revalidateVehicle(vehicleId);
  return { ok: true, message: "Operação atualizada." };
}

export async function addVehicleCost(
  vehicleId: string,
  formData: FormData,
): Promise<OpsActionState> {
  await requireAdmin();

  const kind = String(formData.get("kind") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const amount = Number(digitsOnly(formData.get("amount")));
  const dateRaw = String(formData.get("incurredAt") || "").trim();
  const receiptUrl = String(formData.get("receiptUrl") || "").trim() || null;
  const receiptName = String(formData.get("receiptName") || "").trim() || null;

  if (!isCostKind(kind)) {
    return { ok: false, message: "Escolha o tipo do custo." };
  }
  if (isOtherKind(kind) && !description) {
    return { ok: false, message: "Informe o nome do custo." };
  }
  if (receiptUrl && !isInternalAdminFileUrl(receiptUrl)) {
    return { ok: false, message: "Comprovante inválido." };
  }
  if (!amount || amount <= 0) {
    return { ok: false, message: "Informe o valor do custo." };
  }

  const incurredAt = dateRaw ? new Date(`${dateRaw}T12:00:00`) : new Date();
  if (Number.isNaN(incurredAt.getTime())) {
    return { ok: false, message: "Data inválida." };
  }

  try {
    await prisma.vehicleCost.create({
      data: {
        vehicleId,
        kind,
        description,
        amount,
        incurredAt,
        receiptUrl,
        receiptName,
      },
    });
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível registrar o custo." };
  }

  revalidateVehicle(vehicleId);
  return { ok: true, message: "Custo adicionado." };
}

export async function deleteVehicleCost(
  vehicleId: string,
  costId: string,
): Promise<OpsActionState> {
  await requireAdmin();

  try {
    const existing = await prisma.vehicleCost.findFirst({
      where: { id: costId, vehicleId },
      select: { id: true, receiptUrl: true },
    });
    if (!existing) return { ok: false, message: "Custo não encontrado." };
    await prisma.vehicleCost.delete({ where: { id: costId } });
    await deleteStoragePublicUrls([existing.receiptUrl]);
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível remover o custo." };
  }

  revalidateVehicle(vehicleId);
  return { ok: true, message: "Custo removido." };
}

export async function addVehicleDocument(
  vehicleId: string,
  formData: FormData,
): Promise<OpsActionState> {
  await requireAdmin();

  const kind = String(formData.get("kind") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const fileUrl = String(formData.get("fileUrl") || "").trim();
  const fileName = String(formData.get("fileName") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!isDocKind(kind)) {
    return { ok: false, message: "Escolha o tipo do documento." };
  }
  if (isOtherKind(kind) && !title) {
    return { ok: false, message: "Informe o nome do documento." };
  }
  if (!fileUrl) {
    return { ok: false, message: "Anexe o arquivo do documento." };
  }
  if (!isInternalAdminFileUrl(fileUrl)) {
    return { ok: false, message: "Arquivo inválido." };
  }

  try {
    await prisma.vehicleDocument.create({
      data: {
        vehicleId,
        kind,
        title: title || docKindLabel(kind),
        fileUrl,
        fileName,
        notes,
      },
    });
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível salvar o documento." };
  }

  revalidateVehicle(vehicleId);
  return { ok: true, message: "Documento adicionado." };
}

export async function deleteVehicleDocument(
  vehicleId: string,
  documentId: string,
): Promise<OpsActionState> {
  await requireAdmin();

  try {
    const existing = await prisma.vehicleDocument.findFirst({
      where: { id: documentId, vehicleId },
      select: { id: true, fileUrl: true },
    });
    if (!existing) return { ok: false, message: "Documento não encontrado." };
    await prisma.vehicleDocument.delete({ where: { id: documentId } });
    await deleteStoragePublicUrls([existing.fileUrl]);
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Não foi possível remover o documento." };
  }

  revalidateVehicle(vehicleId);
  return { ok: true, message: "Documento removido." };
}
