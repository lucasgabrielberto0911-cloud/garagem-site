import { NextResponse, type NextRequest } from "next/server";
import { queryPublicVehicleCards } from "@/lib/public-vehicle-cards";

const MAX_IDS = 60;

/**
 * Usada pela página de favoritos: os ids ficam só no dispositivo, então o
 * cliente informa quais veículos quer e a API devolve os que ainda existem.
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ vehicles: [] });
  }

  try {
    const vehicles = await queryPublicVehicleCards({
      where: { id: { in: ids }, status: { not: "vendido" } },
    });

    const order = new Map(ids.map((id, index) => [id, index]));
    vehicles.sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
    );

    return NextResponse.json(
      { vehicles },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("[api/veiculos] falha ao buscar veículos:", error);
    return NextResponse.json(
      { vehicles: [], error: "Não foi possível carregar os veículos." },
      { status: 500 },
    );
  }
}
