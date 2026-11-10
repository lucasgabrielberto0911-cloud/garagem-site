import { purchaseBody, withPurchaseAccess } from "@/lib/purchase-http";
import { findFipeCandidates, getFipeHistory } from "@/lib/fipe-history-store";
import { PurchaseError } from "@/lib/purchase-input";

// POST mantém descrição e decisões privadas fora de URLs/logs de acesso.
export async function POST(request: Request) {
  return withPurchaseAccess(request, async () => {
    const body = await purchaseBody(request);
    if (body.action === "match" && typeof body.brand === "string" && typeof body.model === "string" && typeof body.year === "number") return findFipeCandidates(body.brand, body.model, body.year);
    if (body.action === "history" && typeof body.code === "string" && typeof body.modelYear === "number" && typeof body.expectedFuel === "string" && typeof body.versionLabel === "string" && typeof body.transmission === "string" && typeof body.confirmed === "boolean" && typeof body.fuelDecision === "string") return getFipeHistory({ code: body.code, modelYear: body.modelYear, expectedFuel: body.expectedFuel, versionLabel: body.versionLabel, transmission: body.transmission, confirmed: body.confirmed, fuelDecision: body.fuelDecision });
    throw new PurchaseError("Consulta FIPE inválida.", 400);
  });
}
