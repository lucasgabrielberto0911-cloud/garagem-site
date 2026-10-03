import { Card } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { adminDate } from "@/lib/admin-date";
import { formatAdminMoney } from "@/lib/admin-money";

const labels: Record<string, string> = {
  "vehicle.create": "Anúncio cadastrado",
  "vehicle.update": "Anúncio atualizado",
  "vehicle.status": "Status do anúncio alterado",
  "vehicle.purchase": "Compra atualizada",
  "sale.create": "Venda registrada",
  "sale.update": "Venda atualizada",
  "sale.cancel": "Venda cancelada",
};
function describe(changes: unknown) {
  if (!changes || typeof changes !== "object") return "";
  return Object.entries(changes)
    .flatMap(([key, value]) => {
      if (!["price", "purchasePrice", "salePrice", "status"].includes(key))
        return [];
      const name =
        key === "status"
          ? "Status"
          : key === "purchasePrice"
            ? "Compra"
            : key === "salePrice"
              ? "Venda"
              : "Preço";
      const format = (entry: unknown) =>
        typeof entry === "number"
          ? formatAdminMoney(entry)
          : typeof entry === "string"
            ? entry
            : "Não informado";
      if (
        value &&
        typeof value === "object" &&
        "before" in value &&
        "after" in value
      )
        return `${name}: ${format(value.before)} → ${format(value.after)}`;
      return `${name}: ${format(value)}`;
    })
    .join(" · ");
}

/** A página da conta exige autenticação; o histórico nunca vai à vitrine. */
async function historyData() {
  try {
    const rows = await prisma.adminAudit.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
    });
    const admins = await prisma.admin.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.adminId))] } },
      select: { id: true, name: true },
    });
    return {
      rows,
      names: new Map(admins.map((admin) => [admin.id, admin.name])),
    };
  } catch {
    return null;
  }
}

export async function AdminAuditHistory() {
  const data = await historyData();
  return (
    <Card collapsed title="Histórico de alterações">
      {data ? (
        <>
          <p className="mb-4 text-sm text-muted">
            Últimos 50 registros de anúncios e vendas. Senhas, documentos e
            contatos não entram neste histórico.
          </p>
          {data.rows.length ? (
            <ul className="divide-y divide-white/10">
              {data.rows.map((row) => (
                <li key={row.id} className="space-y-1 py-3">
                  <p className="text-sm font-medium">
                    {labels[row.action] || "Alteração registrada"}
                  </p>
                  <p className="break-words text-sm text-muted">
                    {describe(row.changes)}
                  </p>
                  <p className="text-xs text-muted">
                    {adminDate(row.createdAt, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}{" "}
                    · {data.names.get(row.adminId) || "Conta removida"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Nenhuma alteração registrada desde a atualização do painel.
            </p>
          )}
        </>
      ) : (
        <p role="status" className="text-sm text-muted">
          Não foi possível consultar o histórico agora. Tente atualizar a
          página.
        </p>
      )}
    </Card>
  );
}
