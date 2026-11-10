import { readPurchase } from "@/lib/purchase-store";
import { withPurchaseAccess } from "@/lib/purchase-http";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPurchaseAccess(request, async adminId => readPurchase(adminId, (await context.params).id));
}
