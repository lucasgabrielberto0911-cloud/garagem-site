import Link from "next/link";
import { formatCurrencyBRL } from "@/lib/format";
import type { MonthlyGoalProgress, SalesLeaderboard } from "@/lib/sales-goals";
import { Badge } from "@/components/admin/ui";

export function DashboardSalesGoal({
  salesGoal,
  leaderboard,
}: {
  salesGoal: MonthlyGoalProgress;
  leaderboard: SalesLeaderboard;
}) {
  return (
    <section
      aria-label="Meta do mês e placar de vendas"
      className="border border-white/10 bg-ink p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-cream sm:text-lg">
            Meta do mês &amp; Placar
          </h2>
          <p className="text-xs text-muted">
            Progresso das vendas e comissões do mês atual
          </p>
        </div>
        <div className="flex items-center gap-2">
          {salesGoal.isGoalReached ? (
            <Badge tone="success">Meta atingida! 🎉</Badge>
          ) : (
            <Badge tone="brand">
              {salesGoal.daysRemaining} dia(s) restante(s)
            </Badge>
          )}
          <Link
            href="/admin/vendas?period=month"
            className="text-xs text-brand hover:underline"
          >
            Ver vendas
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Barras de progresso da meta */}
        <div className="space-y-4">
          {/* 1. Meta em unidades */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-semibold uppercase tracking-wider text-cream">
                Veículos vendidos
              </span>
              <span className="font-medium text-cream">
                {salesGoal.monthCount} de {salesGoal.goalUnits} carros (
                {salesGoal.unitsPercent}%)
              </span>
            </div>
            <div className="h-2.5 w-full bg-white/10 overflow-hidden rounded-full">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${Math.min(100, salesGoal.unitsPercent)}%` }}
              />
            </div>
            <p className="text-xs text-muted">
              {salesGoal.unitsRemaining > 0
                ? `Faltam ${salesGoal.unitsRemaining} veículo(s) para a meta · Ritmo sugerido: ${salesGoal.paceNeededPerDay}/dia`
                : "Parabéns! Meta de unidades superada neste mês."}
            </p>
          </div>

          {/* 2. Meta em faturamento */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-semibold uppercase tracking-wider text-cream">
                Faturamento
              </span>
              <span className="font-medium text-cream">
                {formatCurrencyBRL(salesGoal.monthRevenue)} de{" "}
                {formatCurrencyBRL(salesGoal.goalRevenue)} (
                {salesGoal.revenuePercent}%)
              </span>
            </div>
            <div className="h-2.5 w-full bg-white/10 overflow-hidden rounded-full">
              <div
                className="h-full bg-brand-gradient transition-all"
                style={{ width: `${Math.min(100, salesGoal.revenuePercent)}%` }}
              />
            </div>
            <p className="text-xs text-muted">
              {salesGoal.revenueRemaining > 0
                ? `Faltam ${formatCurrencyBRL(salesGoal.revenueRemaining)} em vendas`
                : "Meta financeira do mês atingida."}
            </p>
          </div>

          {/* Bloco de comissões acumuladas */}
          <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs">
            <span className="text-muted">Comissões acumuladas no mês:</span>
            <span className="font-display text-sm font-semibold text-cream">
              {formatCurrencyBRL(leaderboard.totalCommission)}
            </span>
          </div>
        </div>

        {/* Placar de vendas por vendedor */}
        <div className="border border-white/5 bg-asphalt/50 p-3 sm:p-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2 text-xs">
            <span className="font-display font-semibold uppercase tracking-wider text-cream">
              Placar de Vendedores
            </span>
            <span className="text-muted">
              {leaderboard.leaderboard.length} ativo(s)
            </span>
          </div>

          {leaderboard.leaderboard.length === 0 ? (
            <p className="mt-3 text-xs text-muted">
              Nenhuma venda registrada no mês atual.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {leaderboard.leaderboard.map((item, index) => (
                <li
                  key={item.seller}
                  className="flex items-center justify-between gap-2 border-b border-white/5 pb-1.5 text-xs last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                        index === 0
                          ? "bg-brand text-cream"
                          : "bg-white/10 text-muted"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="font-medium text-cream">{item.seller}</span>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <span className="text-muted">{item.count} venda(s)</span>
                    <span className="font-semibold text-cream">
                      {formatCurrencyBRL(item.revenue)}
                    </span>
                    <span className="text-brand-orange text-xs" title="Comissão acumulada">
                      (+{formatCurrencyBRL(item.commission)})
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
