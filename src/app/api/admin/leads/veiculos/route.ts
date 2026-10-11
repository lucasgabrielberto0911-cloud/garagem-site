import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { findLeadVehicleOptions } from "@/lib/admin-lead-vehicle-options";

export async function GET(request: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  try {
    const result = await findLeadVehicleOptions({
      q: params.get("q") || "", id: params.get("id") || undefined, page: Number(params.get("page") || 1),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[admin/leads/veiculos] falha na busca:", error);
    return NextResponse.json({ error: "Não foi possível buscar os veículos. Tente novamente." }, { status: 500 });
  }
}
