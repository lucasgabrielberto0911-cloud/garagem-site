import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isVehicleCuid } from "@/lib/vehicle-slug";
import { isPublicPhotoBlob } from "@/lib/public-photo-url";
export const runtime = "nodejs";
export const maxDuration = 30;
const noCache = { "Cache-Control": "no-store" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isVehicleCuid(id)) return new NextResponse(null, { status: 404, headers: noCache });
  try {
    // Somente foto que já está publicada. Não recebe URL ou ref privada do cliente.
    const photo = await prisma.photo.findFirst({
      where: { id, vehicle: { historical: false, status: { in: ["disponivel", "reservado"] } } },
      select: { url: true },
    });
    if (!photo) return new NextResponse(null, { status: 404, headers: noCache });
    if (!isPublicPhotoBlob(photo.url)) return new NextResponse(null, { status: 204, headers: noCache });
    return NextResponse.redirect(photo.url, { status: 307, headers: noCache });
  } catch {
    console.warn("[photo-zoom] foto maior indisponível");
    return new NextResponse(null, { status: 503, headers: noCache });
  }
}
