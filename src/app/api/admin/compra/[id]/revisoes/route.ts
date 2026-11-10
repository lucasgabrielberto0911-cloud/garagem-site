import { readPurchase, savePurchase } from "@/lib/purchase-store";
import { purchaseBody, saveBody, withPurchaseAccess } from "@/lib/purchase-http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPurchaseAccess(request, async adminId => {
    const { id } = await context.params;
    await readPurchase(adminId, id);
    return savePurchase(adminId, saveBody(await purchaseBody(request)), id);
  });
}
