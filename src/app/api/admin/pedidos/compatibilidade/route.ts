import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/admin-request-origin";
import { expireAdminData } from "@/lib/admin-revalidate";
import { prisma } from "@/lib/prisma";
import { MATCH_DISMISSED_ACTION, wantedStockMatch } from "@/lib/wanted-stock-match";
import { isVehicleCuid } from "@/lib/vehicle-slug";
const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({}, { status: 401, headers });
  if (!isSameOriginRequest(request)) return NextResponse.json({}, { status: 403, headers });
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || typeof body.leadId !== "string" || typeof body.vehicleId !== "string" || !isVehicleCuid(body.leadId) || !isVehicleCuid(body.vehicleId)) {
      return NextResponse.json({ error: "Sugestão inválida." }, { status: 400, headers });
    }
    const [lead, vehicle] = await Promise.all([
      prisma.leadVenda.findUnique({ where: { id: body.leadId } }),
      prisma.vehicle.findUnique({ where: { id: body.vehicleId } }),
    ]);
    if (!lead || !vehicle || !wantedStockMatch(lead, vehicle)) return NextResponse.json({ error: "Esta sugestão não está mais disponível. Atualize os avisos." }, { status: 409, headers });
    await prisma.adminAudit.create({ data: { adminId: session.adminId, entityId: lead.id, action: MATCH_DISMISSED_ACTION, changes: { vehicleId: vehicle.id } } });
    expireAdminData();
    return NextResponse.json({ ok: true }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível dispensar. Tente novamente." }, { status: 500, headers });
  }
}
