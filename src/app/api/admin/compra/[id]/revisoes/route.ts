import { readPurchase, savePurchase } from "@/lib/purchase-store";
import { purchaseBody, saveBody, withPurchaseAccess } from "@/lib/purchase-http";

// Duas chamadas de IA têm timeout próprio e degradam para o cálculo financeiro.
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withPurchaseAccess(request, async adminId => {
    const { id } = await context.params;
    await readPurchase(adminId, id);
    return savePurchase(adminId, saveBody(await purchaseBody(request)), id);
  });
}
