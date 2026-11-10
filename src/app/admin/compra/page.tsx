import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { isFipeHistoryEnabled, isPurchaseEvaluatorEnabled } from "@/lib/purchase-flags";
import { assertPurchaseSchema, listPurchases } from "@/lib/purchase-store";
import { PurchaseForm } from "@/components/admin/compra/PurchaseForm";
import { AdminPageHeader } from "@/components/admin/ui";

export default async function CompraPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  let unavailable = "", initialList: Awaited<ReturnType<typeof listPurchases>> = { evaluations: [], nextCursor: null };
  if (!isPurchaseEvaluatorEnabled()) unavailable = "Avaliador de compra desativado. A ativação depende da preparação do módulo.";
  else {
    try { await assertPurchaseSchema(); initialList = await listPurchases(session.adminId); }
    catch { unavailable = "Avaliador temporariamente indisponível: confira a estrutura do módulo. Cadastro e vendas continuam disponíveis."; }
  }
  if (unavailable) return <div className="space-y-4"><AdminPageHeader title="Avaliador de compra" /><p role="status" className="border border-white/15 p-4 text-sm">{unavailable}</p></div>;
  return <PurchaseForm initialList={initialList} fipeEnabled={isFipeHistoryEnabled()} />;
}
