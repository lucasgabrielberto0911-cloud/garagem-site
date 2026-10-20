import { revalidatePath, revalidateTag } from "next/cache";
import { expireReservations } from "@/lib/reservations";
import { prisma } from "@/lib/prisma";
import { vehiclePath } from "@/lib/vehicle-slug";
import { VEHICLES_PUBLIC_CACHE_TAG } from "@/lib/vehicles";
import { expireAdminData } from "@/lib/admin-revalidate";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response(null, { status: 401 });
  const ids = await expireReservations();
  if (ids.length) {
    revalidateTag(VEHICLES_PUBLIC_CACHE_TAG, { expire: 0 });
    expireAdminData();
    for (const route of ["/", "/estoque", "/sitemap.xml", "/api/estoque", "/admin/veiculos"]) revalidatePath(route);
    const vehicles = await prisma.vehicle.findMany({ where: { id: { in: ids } }, select: { id: true, brand: true, model: true, version: true, yearModel: true } });
    for (const vehicle of vehicles) revalidatePath(vehiclePath(vehicle));
  }
  return Response.json({ released: ids.length }, { headers: { "Cache-Control": "no-store" } });
}
