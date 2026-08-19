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

  const [customers, saleGroups] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        cpf: true,
        email: true,
        address: true,
        notes: true,
        createdAt: true,
      },
    }),
    prisma.sale.groupBy({
      by: ["customerId"],
      where: { customerId: { not: null } },
      _sum: { salePrice: true },
      _max: { saleDate: true },
      _count: { _all: true },
    }),
  ]);

  const byCustomer = new Map(
    saleGroups
      .filter((group) => group.customerId)
      .map((group) => [group.customerId as string, group]),
  );

  const rows = customers.map((customer) => {
    const stats = byCustomer.get(customer.id);
    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      cpf: customer.cpf,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      createdAt: customer.createdAt,
      purchases: stats?._count._all ?? 0,
      totalSpent: stats?._sum.salePrice ?? 0,
      lastPurchase: stats?._max.saleDate ?? null,
    };
  });

  const buyers = rows.filter((row) => row.purchases > 0);
  const revenue = buyers.reduce((sum, row) => sum + row.totalSpent, 0);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Clientes"
        subtitle="Cadastro dos clientes da loja, com histórico de compras e contato rápido."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
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
