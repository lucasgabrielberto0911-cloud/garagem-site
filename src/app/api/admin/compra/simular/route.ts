import { preparePurchase } from "@/lib/purchase-store";
import { purchaseBody, withPurchaseAccess } from "@/lib/purchase-http";

// Duas chamadas de IA têm timeout próprio e degradam para o cálculo financeiro.
export const maxDuration = 60;

export async function POST(request: Request) {
  return withPurchaseAccess(request, async () => preparePurchase((await purchaseBody(request)).input));
}
