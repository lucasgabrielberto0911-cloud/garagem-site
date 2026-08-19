import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminSalesPage } from "@/lib/admin-vehicles";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const page = Number(params.get("page")) || 1;
  const pageSize = Number(params.get("pageSize")) || undefined;

  try {
    const result = await getAdminSalesPage({ page, pageSize });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[api/admin/vendas] falha ao listar:", error);
    return NextResponse.json(
      {
        sales: [],
        total: 0,
        page: 1,
        hasMore: false,
        error: "Não foi possível carregar as vendas.",
      },
      { status: 500 },
    );
  }
}
