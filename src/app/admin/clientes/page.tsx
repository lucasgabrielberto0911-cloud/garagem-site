import { redirect } from "next/navigation";
import { CustomersManager } from "@/components/admin/CustomersManager";
import { AdminPageHeader, StatCard } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { formatCurrencyBRL } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      sales: { select: { salePrice: true, saleDate: true } },
    },
  });

  const rows = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    cpf: customer.cpf,
    email: customer.email,
    address: customer.address,
    notes: customer.notes,
    createdAt: customer.createdAt,
    purchases: customer.sales.length,
    totalSpent: customer.sales.reduce((sum, sale) => sum + sale.salePrice, 0),
    lastPurchase:
      customer.sales.length > 0
        ? customer.sales.reduce(
            (latest, sale) => (sale.saleDate > latest ? sale.saleDate : latest),
            customer.sales[0].saleDate,
          )
        : null,
  }));

  const buyers = rows.filter((row) => row.purchases > 0);
  const revenue = buyers.reduce((sum, row) => sum + row.totalSpent, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Clientes"
        subtitle="Cadastro dos clientes da loja, com histórico de compras e contato rápido."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Clientes cadastrados" value={rows.length} />
        <StatCard label="Já compraram" value={buyers.length} tone={buyers.length > 0 ? "success" : "default"} />
        <StatCard
          label="Receita por clientes"
          value={formatCurrencyBRL(revenue)}
          hint="Soma das vendas registradas"
        />
      </section>

      <CustomersManager customers={rows} />
    </div>
  );
}
