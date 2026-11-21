import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardRefresh } from "@/components/admin/DashboardRefresh";
import { DashboardSalesGoal } from "@/components/admin/DashboardSalesGoal";
import {
  IconAlert,
  IconCash,
  IconClock,
  IconPlus,
} from "@/components/admin/icons";
import {
  AdminPageHeader,
  Badge,
  Card,
} from "@/components/admin/ui";
import { IconCar } from "@/components/site/icons";
import { adminDate } from "@/lib/admin-date";
import { getDashboardData } from "@/lib/admin-stats";
import { getSession } from "@/lib/auth";
import { MAX_FEATURED_PINS } from "@/lib/featured";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <Suspense
      fallback={
        <div className="space-y-4" role="status">
          <p className="text-sm text-cream/80">Carregando central da loja…</p>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div className="skeleton h-14" />
            <div className="skeleton h-14" />
            <div className="skeleton h-14" />
            <div className="skeleton h-14" />
          </div>
          <div className="skeleton h-48" />
          <div className="skeleton h-40" />
        </div>
      }
    >
      <CentralContent />
    </Suspense>
  );
}

async function CentralContent() {
  const data = await getDashboardData();
  const hasFailures = data.failures.length > 0;
  const activeFailed = data.failures.includes("activeVehicles");
  const maxMonthRevenue = Math.max(
    1,
    ...data.monthlySales.map((month) => month.revenue),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Central da loja"
        subtitle="Pendências dos carros, tempo de estoque e resultado do mês."
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-cream/75">
        <p>
          Atualizado em{" "}
          {adminDate(new Date(data.updatedAt), {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
        <DashboardRefresh />
      </div>

      {/* 1. Botões grandes de ação */}
      <section aria-label="Ações rápidas">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Link
            href="/admin/veiculos/novo"
            className="inline-flex min-h-[56px] items-center justify-center gap-2.5 bg-brand px-4 py-3 font-display text-sm font-semibold text-white transition touch-manipulation hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
          >
            <IconPlus className="h-5 w-5 shrink-0" />
            <span>Cadastrar carro</span>
          </Link>
          <Link
            href="/admin/compra"
            className="inline-flex min-h-[56px] items-center justify-center gap-2.5 border border-white/20 bg-ink px-4 py-3 font-display text-sm font-semibold text-cream transition touch-manipulation hover:border-white/40 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <IconCash className="h-5 w-5 shrink-0 text-cream/85" />
            <span>Avaliar compra</span>
          </Link>
          <Link
            href="/admin/em-preparacao"
            className="inline-flex min-h-[56px] items-center justify-center gap-2.5 border border-white/20 bg-ink px-4 py-3 font-display text-sm font-semibold text-cream transition touch-manipulation hover:border-white/40 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <IconCar className="h-5 w-5 shrink-0 text-cream/85" />
            <span>Em preparação</span>
          </Link>
          <Link
            href="/admin/parados"
            className="inline-flex min-h-[56px] items-center justify-center gap-2.5 border border-white/20 bg-ink px-4 py-3 font-display text-sm font-semibold text-cream transition touch-manipulation hover:border-white/40 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <IconClock className="h-5 w-5 shrink-0 text-cream/85" />
            <span>Carros parados</span>
          </Link>
        </div>
      </section>

      {hasFailures ? (
        <p
          role="alert"
          className="border border-brand/60 bg-brand/10 p-4 text-sm text-cream"
        >
          Parte dos dados está indisponível. Os indicadores afetados não são
          mostrados como zero; tente atualizar.
        </p>
      ) : null}

      {/* 2. Pendências dos carros */}
      {!activeFailed ? (
        <Card
          title={`Pendências dos carros${data.pendencies.total > 0 ? ` (${data.pendencies.total})` : ""}`}
          action={
            <Link
              href="/admin/veiculos"
              className="inline-flex min-h-[44px] items-center px-2 text-xs font-medium text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Ver todas
            </Link>
          }
        >
          {data.pendencies.items.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-cream/85">
              <p>Todos os carros ativos estão com fotos, preço, legenda e compra preenchidos.</p>
              <Badge tone="success">Tudo em dia</Badge>
            </div>
          ) : (
            <ul className="divide-y divide-white/10">
              {data.pendencies.items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="flex min-h-[52px] flex-wrap items-center justify-between gap-2 py-2.5 transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <IconAlert className="h-4 w-4 shrink-0 text-red-400" />
                      <span className="break-words text-sm font-semibold text-cream">
                        {item.title}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {item.badges.map((badge) => (
                        <Badge
                          key={badge.label}
                          tone={badge.tone === "brand" ? "brand" : "neutral"}
                        >
                          {badge.label}
                        </Badge>
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {/* 3. Parados por faixa */}
      {!activeFailed ? (
        <Card
          title="Parados por faixa"
          action={
            <Link
              href="/admin/parados"
              className="inline-flex min-h-[44px] items-center px-2 text-xs font-medium text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Ver parados
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {data.stockAge.bands.map((band) => (
              <div
                key={band.id}
                className="border border-white/15 bg-asphalt/50 p-3"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-xs font-semibold uppercase tracking-wider text-cream/80">
                    {band.label}
                  </span>
                  <span className="font-display text-xl font-semibold tabular-nums text-cream">
                    {band.count}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-cream/75">
                  {band.suggestion}
                </p>
              </div>
            ))}
          </div>

          {data.stockAge.oldest.length > 0 ? (
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cream/75">
                Mais antigos no estoque
              </p>
              <ul className="divide-y divide-white/10">
                {data.stockAge.oldest.map((car) => (
                  <li key={car.id}>
                    <Link
                      href={car.href}
                      className="flex min-h-[44px] items-center justify-between gap-3 py-2 text-sm transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span className="break-words font-medium text-cream">
                        {car.name}
                      </span>
                      <span className="shrink-0 font-display text-xs font-semibold tabular-nums text-red-400">
                        {car.days} dias
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* 4. Vendas do mês × meta */}
      {!data.failures.includes("monthSales") ? (
        <DashboardSalesGoal salesGoal={data.salesGoal} />
      ) : null}

      {/* 5. Lucro previsto do estoque */}
      {!activeFailed ? (
        <Card
          title="Lucro previsto do estoque"
          action={
            data.stockCapital.missingPurchaseCount > 0 ? (
              <Link
                href="/admin/veiculos"
                className="inline-flex min-h-[44px] items-center px-2 text-xs font-medium text-red-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {data.stockCapital.missingPurchaseCount} carro(s) sem preço de compra
              </Link>
            ) : null
          }
        >
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="font-display text-3xl font-semibold tabular-nums text-cream">
                {data.stockCapital.withCostBasisCount > 0
                  ? formatCurrencyBRL(data.stockCapital.potentialProfit)
                  : "—"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-cream/80">
                Soma de (preço − compra − custos) em{" "}
                {data.stockCapital.withCostBasisCount} carro(s) próprio(s)
                disponível(eis) ou reservado(s).
                {data.stockCapital.consignedCount > 0
                  ? ` ${data.stockCapital.consignedCount} consignado(s) fora do cálculo.`
                  : ""}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs uppercase tracking-wider text-cream/75">
                Capital investido (com compra)
              </p>
              <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-cream">
                {formatCurrencyBRL(data.stockCapital.investedTotal)}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* 6. Mais números (recolhido) */}
      <details className="border border-white/15 bg-ink">
        <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-display text-sm font-semibold text-cream transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <span>Mais números</span>
          <span className="text-xs font-normal text-cream/75">
            Valor do estoque, ticket médio, km médio e últimos 6 meses
          </span>
        </summary>
        <div className="space-y-5 border-t border-white/10 p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="border border-white/10 bg-asphalt/50 p-3">
              <p className="text-xs text-cream/75">Valor do estoque</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums text-cream">
                {activeFailed
                  ? "—"
                  : formatCurrencyBRL(data.stockCapital.stockValue)}
              </p>
            </div>
            <div className="border border-white/10 bg-asphalt/50 p-3">
              <p className="text-xs text-cream/75">Ticket médio (mês)</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums text-cream">
                {data.monthTicket > 0
                  ? formatCurrencyBRL(data.monthTicket)
                  : "—"}
              </p>
            </div>
            <div className="border border-white/10 bg-asphalt/50 p-3">
              <p className="text-xs text-cream/75">Km médio</p>
              <p className="mt-1 font-display text-lg font-semibold tabular-nums text-cream">
                {activeFailed || data.stockCapital.averageKm <= 0
                  ? "—"
                  : `${formatNumberBR(Math.round(data.stockCapital.averageKm))} km`}
              </p>
            </div>
            <div className="border border-white/10 bg-asphalt/50 p-3">
              <p className="text-xs text-cream/75">Destaques na vitrine</p>
              <Link
                href="/admin/veiculos?tab=destaques"
                className="mt-1 inline-flex min-h-[44px] items-center font-display text-lg font-semibold tabular-nums text-cream hover:text-red-400"
              >
                {data.featured}/{MAX_FEATURED_PINS}
              </Link>
            </div>
          </div>

          <div>
            <p className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-cream/80">
              Vendas nos últimos 6 meses
            </p>
            {data.failures.includes("monthlySales") ? (
              <p role="status" className="text-sm text-cream/80">
                Evolução indisponível. Tente atualizar.
              </p>
            ) : (
              <div className="space-y-3">
                {data.monthlySales.map((month) => (
                  <div key={month.key} className="space-y-1">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span>
                        {month.key.slice(5)}/{month.key.slice(0, 4)} ·{" "}
                        {month.count} venda(s)
                      </span>
                      <span className="tabular-nums">
                        {formatCurrencyBRL(month.revenue)}
                      </span>
                    </div>
                    <div className="h-2 bg-white/10">
                      <div
                        className="h-2 bg-brand"
                        style={{
                          width: `${(month.revenue / maxMonthRevenue) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
