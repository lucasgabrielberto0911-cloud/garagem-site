import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getSellableVehicles } from "@/lib/admin-vehicles";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const take = Number(params.get("take")) || Number(params.get("pageSize")) || 20;

  try {
    const vehicles = await getSellableVehicles({
      q: params.get("q") ?? "",
      take,
    });
    const reservations = await prisma.vehicleReservation.findMany({ where: { vehicleId: { in: vehicles.map((vehicle) => vehicle.id) }, status: "ativa", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" }, include: { customer: { select: { id: true, name: true, phone: true, cpf: true, rg: true, address: true } } } });
    const activeByVehicle = new Map<string, (typeof reservations)[number]>();
    for (const reservation of reservations) if (!activeByVehicle.has(reservation.vehicleId)) activeByVehicle.set(reservation.vehicleId, reservation);
    return NextResponse.json(
      { vehicles: vehicles.map((vehicle) => { const reservation = activeByVehicle.get(vehicle.id); return { ...vehicle, reservation: reservation ? { customerId: reservation.customerId, customer: reservation.customer, deposit: Number(reservation.deposit) } : null }; }) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[api/admin/vendas/veiculos] falha ao buscar:", error);
    return NextResponse.json(
      { vehicles: [], error: "Não foi possível buscar os veículos." },
      { status: 500 },
    );
  }
}
