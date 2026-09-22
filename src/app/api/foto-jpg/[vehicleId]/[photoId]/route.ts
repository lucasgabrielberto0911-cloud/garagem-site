import { NextResponse } from "next/server";
import { archivePhotoFilename } from "@/lib/photo-archive";
import {
  attachmentHeaders,
  loadGalleryJpeg,
} from "@/lib/photo-archive-download";
import { prisma } from "@/lib/prisma";
import { checkPhotoJpgRateLimit } from "@/lib/rate-limit";
import { extractVehicleIdFromParam } from "@/lib/vehicle-slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Download público em JPEG. A ficha continua exibindo o WebP do Storage.
 *
 * Fica fora de `/api/veiculos` de propósito: o next.config exclui o sharp
 * desse prefixo para não inflar as Functions leves do estoque. Qualidade
 * em `DOWNLOAD_JPEG_QUALITY` (90, mozjpeg), só neste request.
 */
function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ vehicleId: string; photoId: string }> },
) {
  const { vehicleId: vehicleParam, photoId } = await context.params;
  const vehicleId = extractVehicleIdFromParam(vehicleParam);
  if (!vehicleId || !/^[a-z0-9]{16,40}$/i.test(photoId)) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  }

  const limited = await checkPhotoJpgRateLimit(clientKey(request));
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Muitos downloads. Tente de novo em ${limited.retryAfterSec}s.` },
      {
        status: 429,
        headers: {
          "Retry-After": String(limited.retryAfterSec ?? 60),
        },
      },
    );
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, historical: false },
    select: {
      brand: true,
      model: true,
      yearModel: true,
      photos: {
        orderBy: { order: "asc" },
        select: { id: true, url: true },
      },
    },
  });

  const index = vehicle?.photos.findIndex((photo) => photo.id === photoId) ?? -1;
  const photo = vehicle && index >= 0 ? vehicle.photos[index] : null;
  if (!vehicle || !photo) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  }

  const bytes = await loadGalleryJpeg(photo.url);
  if (!bytes) {
    return NextResponse.json(
      { error: "Não foi possível preparar o JPG." },
      { status: 502 },
    );
  }

  const filename = archivePhotoFilename({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.yearModel,
    index: index + 1,
    url: photo.url,
  });

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      ...attachmentHeaders(filename, "image/jpeg"),
      "Content-Length": String(bytes.byteLength),
    },
  });
}
