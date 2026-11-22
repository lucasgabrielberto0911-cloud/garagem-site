import { NextResponse } from "next/server";
import { e2ePhotoFixture } from "@/lib/e2e-photo-fixture";
import { loadCatalogJpeg } from "@/lib/photo-archive-download";
import { prisma } from "@/lib/prisma";
import { isPublicPhotoSource } from "@/lib/public-photo-source";
import { extractVehicleIdFromParam } from "@/lib/vehicle-slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
const noCache = { "Cache-Control": "no-store" };

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
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404, headers: noCache });
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
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404, headers: noCache });
  }

  const fixture = await e2ePhotoFixture();
  if (!fixture && !isPublicPhotoSource(photo.url)) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404, headers: noCache });
  }

  const bytes = await loadCatalogJpeg(photo.url);
  if (!bytes) {
    return NextResponse.json(
      { error: "Não foi possível preparar o JPG." },
      { status: 502, headers: noCache },
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
