import { purchaseBody, withPurchaseAccess } from "@/lib/purchase-http";
import { lookupPurchasePlate } from "@/lib/purchase-plate";
import { findFipeCandidates, findPurchaseFipeCodes } from "@/lib/fipe-history-store";
import { isFipeHistoryEnabled } from "@/lib/purchase-flags";

// POST privado impede que a placa apareça em URLs do admin ou analytics.
export async function POST(request: Request) {
  return withPurchaseAccess(request, async () => {
    const { plate } = await purchaseBody(request);
    const identity = await lookupPurchasePlate(plate);
    try {
      if (!isFipeHistoryEnabled()) return { identity, candidates: [], warning: "Consulta FIPE desativada. Use uma referência manual." };
      const matched = identity.codes.length ? await findPurchaseFipeCodes(identity.codes, identity.modelYear) : await findFipeCandidates(identity.brand, identity.model, identity.modelYear);
      return { identity, candidates: matched.candidates, warning: "Escolha a versão para confirmar a identidade." };
    } catch { return { identity, candidates: [], warning: "Veículo identificado, mas a FIPE está indisponível. Tente buscar versões ou informe referência manual." }; }
  });
}
