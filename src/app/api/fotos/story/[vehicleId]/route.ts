import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  loadArchiveOriginal,
  vehiclePhotoStoragePath,
} from "@/lib/photo-archive-download";
import { prisma } from "@/lib/prisma";
import { isPublicPhotoSource } from "@/lib/public-photo-source";
import { extractVehicleIdFromParam } from "@/lib/vehicle-slug";

export const runtime = "nodejs";
export const maxDuration = 30;

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

/**
 * Entrega same-origin da foto do veículo para o Kit de Divulgação no painel
 * admin (próprios e consignados), evitando erro de CORS / canvas contaminado.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ vehicleId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401, headers: noStoreHeaders },
    );
  }

  const { vehicleId: rawParam } = await context.params;
  const vehicleId = extractVehicleIdFromParam(rawParam);
  if (!vehicleId) {
    return NextResponse.json(
      { error: "Veículo não encontrado." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, historical: false },
    select: {
      photos: {
        orderBy: { order: "asc" },
        select: { url: true },
      },
    },
  });

  if (!vehicle) {
    return NextResponse.json(
      { error: "Veículo não encontrado." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  const requestedUrl = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  let targetUrl = "";

  if (requestedUrl) {
    const belongsToVehicle = vehicle.photos.some(
      (photo) => photo.url === requestedUrl,
    );
    const allowedFromAcervo =
      isPublicPhotoSource(requestedUrl) ||
      Boolean(vehiclePhotoStoragePath(requestedUrl));
    if (!belongsToVehicle && !allowedFromAcervo) {
      return NextResponse.json(
        { error: "Foto inválida para este anúncio." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    targetUrl = requestedUrl;
  } else {
    targetUrl = vehicle.photos[0]?.url ?? "";
  }

  if (!targetUrl) {
    return NextResponse.json(
      { error: "Anúncio sem foto cadastrada." },
      { status: 404, headers: noStoreHeaders },
    );
  }

  const file = await loadArchiveOriginal(targetUrl, "admin");
  if (!file) {
    return NextResponse.json(
      { error: "Não foi possível carregar a foto." },
      { status: 502, headers: noStoreHeaders },
    );
  }

  return new NextResponse(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
      "Content-Length": String(file.bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
