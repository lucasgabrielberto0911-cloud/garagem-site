import { customerSearchWhere } from "@/lib/admin-customer-search";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomersManager } from "@/components/admin/CustomersManager";
import { AdminPageHeader, StatCard } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { formatCurrencyBRL } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ADMIN_CUSTOMERS_PAGE_SIZE } from "@/lib/admin-vehicles";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[]; cliente?: string | string[] }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const query = await searchParams;
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  const q = (first(query.q) || "").trim();
  const pageInput = Number(first(query.page));
  const page = Number.isFinite(pageInput) ? Math.max(1, Math.trunc(pageInput)) : 1;
  const pageSize = ADMIN_CUSTOMERS_PAGE_SIZE;
  const selected = first(query.cliente);
  const filtered = Boolean(q || selected);
  const where = { AND: [customerSearchWhere(q), ...(selected ? [{ id: selected }] : [])] };

  const [customers, filteredTotal, globalTotal, buyersCount, revenueAgg] =
    await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      prisma.customer.count({ where }),
      filtered ? prisma.customer.count() : Promise.resolve(0),
      prisma.customer.count({ where: { sales: { some: {} } } }),
      prisma.sale.aggregate({ _sum: { salePrice: true } }),
    ]);

  const saleGroups =
    customers.length === 0
      ? []
      : await prisma.sale.groupBy({
          by: ["customerId"],
          where: {
            customerId: { in: customers.map((customer) => customer.id) },
          },
          _sum: { salePrice: true },
          _max: { saleDate: true },
          _count: { _all: true },
        });

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

  const registeredCount = filtered ? globalTotal : filteredTotal;
  const revenue = revenueAgg._sum.salePrice ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Clientes"
        subtitle="Cadastro dos clientes da loja, com histórico de compras e contato rápido."
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Clientes cadastrados" value={registeredCount} />
        <StatCard
          label="Já compraram"
          value={buyersCount}
          tone={buyersCount > 0 ? "success" : "default"}
        />
        <StatCard
          label="Receita por clientes"
          value={formatCurrencyBRL(revenue)}
          hint="Soma das vendas registradas"
        />
      </section>

      {selected ? <Link href="/admin/clientes" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Voltar a todos os clientes</Link> : null}
      <CustomersManager
        customers={rows}
        query={q}
        page={page}
        pageSize={pageSize}
        total={filteredTotal}
      />
    </div>
  );
}
