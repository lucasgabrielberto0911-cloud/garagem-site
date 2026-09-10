import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { attachmentHeaders, loadArchiveOriginal } from "@/lib/photo-archive-download";
import { archivePhotoFilename } from "@/lib/photo-archive";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; photoId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id, photoId } = await context.params;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
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

  if (!vehicle) {
    return NextResponse.json({ error: "Veículo não encontrado." }, { status: 404 });
  }

  const index = vehicle.photos.findIndex((photo) => photo.id === photoId);
  const photo = index >= 0 ? vehicle.photos[index] : null;
  if (!photo) {
    return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  }

  const file = await loadArchiveOriginal(photo.url);
  if (!file) {
    return NextResponse.json(
      { error: "Não foi possível baixar esta foto." },
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

  return new NextResponse(Uint8Array.from(file.bytes), {
    status: 200,
    headers: {
      ...attachmentHeaders(filename, file.contentType),
      "Content-Length": String(file.bytes.byteLength),
    },
  });
}
