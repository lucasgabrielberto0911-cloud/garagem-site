import { NextResponse } from "next/server";
import {
  buildResilientPhotoZip,
  encodeZipFailuresHeader,
  PHOTO_ZIP_COUNTS_HEADER,
  PHOTO_ZIP_FAILURES_HEADER,
} from "@/lib/admin-photo-zip";
import { getSession } from "@/lib/auth";
import {
  attachmentHeaders,
  loadAdminJpegDetailed,
} from "@/lib/photo-archive-download";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await context.params;
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
    return NextResponse.json(
      { error: "Veículo não encontrado." },
      { status: 404 },
    );
  }

  if (vehicle.photos.length === 0) {
    return NextResponse.json(
      { error: "Este anúncio ainda não tem fotos." },
      { status: 400 },
    );
  }

  const result = await buildResilientPhotoZip({
    vehicle: {
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.yearModel,
    },
    photos: vehicle.photos,
    loadPhoto: ({ photo, signal }) =>
      loadAdminJpegDetailed(photo.url, {
        signal,
        timeoutMs: 8_000,
      }),
    retries: 1,
    timeoutMs: 8_500,
    concurrency: 3,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        failures: result.failures,
      },
      { status: 502 },
    );
  }

  const headers: Record<string, string> = {
    ...attachmentHeaders(result.zipFilename, "application/zip"),
    "Content-Length": String(result.zip.byteLength),
    [PHOTO_ZIP_COUNTS_HEADER]: `${result.downloadedCount}/${result.totalCount}`,
  };

  if (result.failures.length > 0) {
    headers[PHOTO_ZIP_FAILURES_HEADER] = encodeZipFailuresHeader(
      result.failures,
    );
  }

  return new NextResponse(Uint8Array.from(result.zip), {
    status: 200,
    headers,
  });
}
