import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { searchCustomers } from "@/lib/admin-vehicles";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const take = Number(params.get("take")) || Number(params.get("pageSize")) || 20;

  try {
    const customers = await searchCustomers({
      q: params.get("q") ?? "",
      take,
    });
    return NextResponse.json(
      { customers },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[api/admin/clientes] falha ao buscar:", error);
    return NextResponse.json(
      { customers: [], error: "Não foi possível buscar os clientes." },
      { status: 500 },
    );
  }
}
