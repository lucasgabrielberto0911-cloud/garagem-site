import { NextResponse } from "next/server";
import { loadPhotoWithRetry } from "@/lib/admin-photo-zip";
import { getSession } from "@/lib/auth";
import { archivePhotoFilename } from "@/lib/photo-archive";
import {
  attachmentHeaders,
  loadAdminJpegDetailed,
} from "@/lib/photo-archive-download";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function statusFromFailureReason(reason: string): number {
  if (/n[aã]o\s+encontrad/i.test(reason)) return 404;
  if (/tempo\s+esgotado/i.test(reason)) return 504;
  return 502;
}

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

  const outcome = await loadPhotoWithRetry(
    (signal) =>
      loadAdminJpegDetailed(photo.url, {
        signal,
        timeoutMs: 8_000,
      }),
    {
      retries: 1,
      timeoutMs: 8_500,
    },
  );

  if (!outcome.ok) {
    return NextResponse.json(
      {
        error: `Não foi possível baixar esta foto (${outcome.reason}).`,
        reason: outcome.reason,
      },
      { status: statusFromFailureReason(outcome.reason) },
    );
  }

  const filename = archivePhotoFilename({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.yearModel,
    index: index + 1,
    url: photo.url,
  });

  return new NextResponse(Buffer.from(outcome.bytes), {
    status: 200,
    headers: {
      ...attachmentHeaders(filename, "image/jpeg"),
      "Content-Length": String(outcome.bytes.byteLength),
    },
  });
}
