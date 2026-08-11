import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import {
  fetchFipeBrands,
  fetchFipeDetail,
  fetchFipeModels,
  fetchFipeYears,
  type FipeVehicleType,
} from "@/lib/fipe";

export const dynamic = "force-dynamic";

function parseType(raw: string | null): FipeVehicleType | null {
  if (raw === "cars" || raw === "motorcycles") return raw;
  if (raw === "carro") return "cars";
  if (raw === "moto") return "motorcycles";
  return null;
}

/**
 * Proxy autenticado da FIPE para o formulário admin.
 * Query: resource=brands|models|years|detail + vehicleType + ids.
 * Falhas da FIPE retornam 502 com mensagem — o formulário segue editável.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const resource = params.get("resource");
  const vehicleType = parseType(params.get("vehicleType") ?? params.get("tipo"));
  const brandId = params.get("brandId")?.trim() ?? "";
  const modelId = params.get("modelId")?.trim() ?? "";
  const yearId = params.get("yearId")?.trim() ?? "";

  if (!resource || !vehicleType) {
    return NextResponse.json(
      { error: "Parâmetros inválidos (resource, vehicleType)." },
      { status: 400 },
    );
  }

  try {
    if (resource === "brands") {
      const brands = await fetchFipeBrands(vehicleType);
      return NextResponse.json({ brands });
    }

    if (resource === "models") {
      if (!brandId) {
        return NextResponse.json({ error: "brandId obrigatório." }, { status: 400 });
      }
      const models = await fetchFipeModels(vehicleType, brandId);
      return NextResponse.json({ models });
    }

    if (resource === "years") {
      if (!brandId || !modelId) {
        return NextResponse.json(
          { error: "brandId e modelId obrigatórios." },
          { status: 400 },
        );
      }
      const years = await fetchFipeYears(vehicleType, brandId, modelId);
      return NextResponse.json({ years });
    }

    if (resource === "detail") {
      if (!brandId || !modelId || !yearId) {
        return NextResponse.json(
          { error: "brandId, modelId e yearId obrigatórios." },
          { status: 400 },
        );
      }
      const detail = await fetchFipeDetail(
        vehicleType,
        brandId,
        modelId,
        yearId,
      );
      return NextResponse.json({ detail });
    }

    return NextResponse.json({ error: "resource inválido." }, { status: 400 });
  } catch (error) {
    console.error("[api/admin/fipe]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Consulta FIPE indisponível no momento.",
      },
      { status: 502 },
    );
  }
}
