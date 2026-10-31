import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ADMIN_DATA_TAG } from "@/lib/admin-cache";
import { fetchFipe, parseFipeQuery, type FipeVehicle } from "@/lib/fipe";

const headers = { "Cache-Control": "private, no-store" };

const similarStock = unstable_cache(async (category: string, brand: string, model: string, yearModel: number, exclude: string) => {
  // O estoque pode usar “Golf” onde a FIPE devolve “Golf GTI”.
  const words = model.split(/\s+/);
  const models = words.map((_, index) => words.slice(0, index + 1).join(" "));
  const result = await prisma.vehicle.aggregate({
    where: {
      category, brand: { equals: brand, mode: "insensitive" },
      model: { in: models, mode: "insensitive" }, yearModel,
      status: { in: ["disponivel", "reservado"] }, historical: false,
      price: { gt: 0 }, ...(exclude ? { id: { not: exclude } } : {}),
    },
    _count: true, _min: { price: true }, _max: { price: true }, _avg: { price: true },
  });
  return result._count && result._min.price != null && result._max.price != null && result._avg.price != null
    ? { count: result._count, min: result._min.price, max: result._max.price, average: result._avg.price }
    : null;
}, ["admin-fipe-stock-v1"], { revalidate: 60, tags: [ADMIN_DATA_TAG] });

export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Entre novamente para consultar a FIPE." }, { status: 401, headers });
  const query = parseFipeQuery(new URL(request.url).searchParams);
  if (!query) return NextResponse.json({ error: "Consulta FIPE inválida." }, { status: 400, headers });
  try {
    const result = await fetchFipe(query);
    if (!query.year) return NextResponse.json(result, { headers });
    const vehicle = result as FipeVehicle;
    const stock = await similarStock(query.category, vehicle.brand, vehicle.model, vehicle.yearModel, query.exclude ?? "").catch(() => null);
    return NextResponse.json({ vehicle, stock }, { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message.startsWith("Limite") ? error.message : "Não foi possível consultar a FIPE. Tente novamente." }, { status: 502, headers });
  }
}
