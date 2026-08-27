import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getAdminVehiclesPage,
  parseAdminVehiclesDir,
  parseAdminVehiclesSort,
  type VehiclesTab,
} from "@/lib/admin-vehicles";

function resolveTab(raw: string | null): VehiclesTab {
  return raw === "vendidos" ? "vendidos" : "estoque";
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const page = Number(params.get("page")) || 1;
  const pageSize = Number(params.get("pageSize")) || undefined;
  const sort = parseAdminVehiclesSort(params.get("sort"));
  const dir = parseAdminVehiclesDir(params.get("dir"), sort);

  try {
    const result = await getAdminVehiclesPage({
      q: params.get("q") ?? "",
      tab: resolveTab(params.get("tab")),
      status: params.get("status") ?? undefined,
      page,
      pageSize,
      sort,
      dir,
    });

    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[api/admin/veiculos] falha ao listar:", error);
    return NextResponse.json(
      {
        vehicles: [],
        total: 0,
        page: 1,
        hasMore: false,
        error: "Não foi possível carregar os veículos.",
      },
      { status: 500 },
    );
  }
}
