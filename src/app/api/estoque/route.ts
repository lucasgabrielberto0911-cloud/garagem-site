import { NextResponse, type NextRequest } from "next/server";
import { getStockPage, parseStockFilters, STOCK_PAGE_SIZE } from "@/lib/vehicles";

/**
 * Páginas seguintes do estoque público (rolagem infinita).
 * Só devolve campos de card — sem FIPE, placa, compra ou operação.
 */
export async function GET(request: NextRequest) {
  const input = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseStockFilters(input);

  try {
    const result = await getStockPage({
      ...filters,
      pageSize: filters.pageSize ?? STOCK_PAGE_SIZE,
    });

    return NextResponse.json(
      {
        vehicles: result.vehicles,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        hasMore: result.page * result.pageSize < result.total,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (error) {
    console.error("[api/estoque] falha ao paginar estoque:", error);
    return NextResponse.json(
      {
        vehicles: [],
        total: 0,
        page: 1,
        pageSize: STOCK_PAGE_SIZE,
        hasMore: false,
        error: "Não foi possível carregar o estoque.",
      },
      { status: 500 },
    );
  }
}
