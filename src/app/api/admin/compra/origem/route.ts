import { purchaseBody, withPurchaseAccess } from "@/lib/purchase-http";
import { findPurchaseSources, loadPurchaseSource } from "@/lib/purchase-source";
import { PurchaseError } from "@/lib/purchase-input";

export async function POST(request: Request) {
  return withPurchaseAccess(request, async () => {
    const body = await purchaseBody(request);
    if (body.action === "search" && typeof body.plate === "string" && body.plate.length <= 10) return findPurchaseSources(body.plate);
    if (body.action === "load" && (body.kind === "vehicle" || body.kind === "lead") && typeof body.id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(body.id)) return loadPurchaseSource({ kind: body.kind, id: body.id });
    throw new PurchaseError("Origem interna inválida.", 400);
  });
}
