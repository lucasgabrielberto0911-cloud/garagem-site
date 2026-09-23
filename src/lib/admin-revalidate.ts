import { revalidateTag } from "next/cache";
import { ADMIN_DATA_TAG } from "@/lib/admin-cache";

/**
 * Chamar depois de gravar veículo, venda, lead, depoimento ou dados da loja.
 * `expire: 0` para o próximo carregamento do painel já vir com o número novo,
 * sem servir o valor velho enquanto revalida.
 */
export function expireAdminData() {
  revalidateTag(ADMIN_DATA_TAG, { expire: 0 });
}
