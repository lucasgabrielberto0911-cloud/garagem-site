import { preparePurchase } from "@/lib/purchase-store";
import { purchaseBody, withPurchaseAccess } from "@/lib/purchase-http";

export async function POST(request: Request) {
  return withPurchaseAccess(request, async () => preparePurchase((await purchaseBody(request)).input));
}
