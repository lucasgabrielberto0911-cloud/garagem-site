import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { attachmentHeaders, loadArchiveOriginal } from "@/lib/photo-archive-download";
import {
  archivePhotoFilename,
  archiveZipFilename,
} from "@/lib/photo-archive";
import { prisma } from "@/lib/prisma";
import { buildZipStore } from "@/lib/zip-store";

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
    return NextResponse.json({ error: "Veículo não encontrado." }, { status: 404 });
  }

  if (vehicle.photos.length === 0) {
    return NextResponse.json(
      { error: "Este anúncio ainda não tem fotos." },
      { status: 400 },
    );
  }

  const entries: Array<{ name: string; data: Uint8Array }> = [];
  const usedNames = new Set<string>();

  for (const [index, photo] of vehicle.photos.entries()) {
    const file = await loadArchiveOriginal(photo.url);
    if (!file) continue;

    let name = archivePhotoFilename({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.yearModel,
      index: index + 1,
      url: photo.url,
    });
    if (usedNames.has(name)) {
      name = name.replace(/(\.[a-z0-9]+)$/i, `-${photo.id.slice(-6)}$1`);
    }
    usedNames.add(name);
    entries.push({ name, data: file.bytes });
  }

  if (entries.length === 0) {
    return NextResponse.json(
      { error: "Não foi possível baixar as fotos do Storage." },
      { status: 502 },
    );
  }

  const zip = buildZipStore(entries);
  const filename = archiveZipFilename({
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.yearModel,
  });

  return new NextResponse(Uint8Array.from(zip), {
    status: 200,
    headers: {
      ...attachmentHeaders(filename, "application/zip"),
      "Content-Length": String(zip.byteLength),
    },
  });
}
