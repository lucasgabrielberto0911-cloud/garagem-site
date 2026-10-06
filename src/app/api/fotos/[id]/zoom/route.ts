import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isVehicleCuid } from "@/lib/vehicle-slug";
import { ownGalleryPath } from "@/lib/photo-zoom-path";
import { loadPhotoZoom } from "@/lib/photo-zoom-store";
import { hasSupabaseServiceRole } from "@/lib/supabase";
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
    const path = ownGalleryPath(photo.url, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (!path || !hasSupabaseServiceRole()) return new NextResponse(null, { status: 204, headers: noCache });
    const bytes = await loadPhotoZoom(path);
    if (!bytes) return new NextResponse(null, { status: 204, headers: noCache });
    return new NextResponse(Buffer.from(bytes), { headers: {
      "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
    } });
  } catch {
    console.warn("[photo-zoom] foto maior indisponível");
    return new NextResponse(null, { status: 503, headers: noCache });
  }
}
