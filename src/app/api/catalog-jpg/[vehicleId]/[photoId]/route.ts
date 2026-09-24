import { NextResponse } from "next/server";
import { loadGalleryJpeg } from "@/lib/photo-archive-download";
import { prisma } from "@/lib/prisma";
import { extractVehicleIdFromParam } from "@/lib/vehicle-slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * JPEG inline para o crawler do catálogo Meta.
 * A galeria do site continua em WebP. Esta rota só existe porque o spec de
 * imagem do catálogo é JPEG/PNG. Cache de CDN — não é ISR.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ vehicleId: string; photoId: string }> },
) {
  const { vehicleId: vehicleParam, photoId } = await context.params;
  const vehicleId = extractVehicleIdFromParam(vehicleParam);
  if (!vehicleId || !/^[a-z0-9]{16,40}$/i.test(photoId)) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, status: "disponivel", historical: false },
    select: {
      photos: {
        where: { id: photoId },
        select: { url: true },
        take: 1,
      },
    },
  });
  const photo = vehicle?.photos[0];
  if (!photo) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  }

  const bytes = await loadGalleryJpeg(photo.url);
  if (!bytes) {
    return NextResponse.json(
      { error: "Não foi possível preparar o JPG." },
      { status: 502 },
    );
  }

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": "inline",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
