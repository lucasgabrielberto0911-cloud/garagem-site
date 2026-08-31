import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getSellableVehicles } from "@/lib/admin-vehicles";

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
    return NextResponse.json(
      { vehicles },
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
