import { listPurchases, savePurchase } from "@/lib/purchase-store";
import { purchaseBody, saveBody, withPurchaseAccess } from "@/lib/purchase-http";
import { PurchaseError } from "@/lib/purchase-input";

export async function GET(request: Request) {
  return withPurchaseAccess(request, async adminId => {
    const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
    if (cursor && !/^[a-zA-Z0-9_-]{1,100}$/.test(cursor)) throw new PurchaseError("Cursor inválido.", 400);
    return listPurchases(adminId, cursor);
  });
}
export async function POST(request: Request) {
  return withPurchaseAccess(request, async adminId => savePurchase(adminId, saveBody(await purchaseBody(request))));
}
