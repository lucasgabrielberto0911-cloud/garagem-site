import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import {
  IconAlert,
  IconChevronDown,
  IconExternal,
  IconImage,
  IconPlus,
  IconStar,
} from "@/components/admin/icons";
import {
  AdminPageHeader,
  Badge,
  Card,
  EmptyState,
  StatCard,
  adminStatGrid,
  btn,
} from "@/components/admin/ui";
import { IconQuote } from "@/components/site/icons";
import { getSession } from "@/lib/auth";
import { getDashboardData, STALE_DAYS } from "@/lib/admin-stats";
import {
  buildDashboardAlerts,
  splitDashboardAlerts,
  type DashboardAlert,
} from "@/lib/admin-dashboard";
import { formatCurrencyBRL, formatNumberBR, formatPhoneBR } from "@/lib/format";
import { LEAD_STATUS_LABEL, LEAD_STATUSES } from "@/lib/leads";
import { coverSrc } from "@/lib/stock-query";
import { vehiclePath } from "@/lib/vehicle-slug";

export const dynamic = "force-dynamic";

const ALERT_ICON: Record<DashboardAlert["icon"], ReactNode> = {
  alert: <IconAlert className="h-4 w-4" />,
  image: <IconImage className="h-4 w-4" />,
  star: <IconStar className="h-4 w-4" />,
  quote: <IconQuote className="h-4 w-4" />,
};

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const data = await getDashboardData();
  const { vehicles, sales, leads, alerts } = data;

  const alertList = buildDashboardAlerts({ ...alerts, staleDays: STALE_DAYS });
  const { head: alertHead, rest: alertRest } = splitDashboardAlerts(alertList);

  const leadsCard = (
    <StatCard
      key="leads"
      label="Leads novos"
      value={leads.byStatus.novo}
      hint={`${leads.total} lead(s) no total`}
      tone={leads.byStatus.novo > 0 ? "brand" : "default"}
      href="/admin/leads?status=novo"
    />
  );
  const availableCard = (
    <StatCard
      key="available"
      label="Disponíveis"
      value={vehicles.available}
      hint={`${vehicles.reserved} reservado(s) · ${vehicles.sold} vendido(s)`}
      href="/admin/veiculos?status=disponivel"
    />
  );
  const secondaryCards = [
    <StatCard
      key="stock-value"
      label="Valor do estoque"
      value={formatCurrencyBRL(vehicles.stockValue)}
      hint={
        [
          vehicles.ownedAvailable > 0
            ? `Média ${formatCurrencyBRL(vehicles.averagePrice)}`
            : vehicles.available > 0
              ? ""
              : "Nenhum veículo disponível",
          vehicles.consignedAvailable > 0
            ? `${vehicles.consignedAvailable} consignado(s) fora`
            : "",
        ]
          .filter(Boolean)
          .join(" · ") || undefined
      }
    />,
    <StatCard
      key="month-sales"
      label="Vendas no mês"
      value={sales.monthCount}
      hint={
        sales.monthCount > 0
          ? formatCurrencyBRL(sales.monthRevenue)
          : "Nenhuma venda registrada"
      }
      tone={sales.monthCount > 0 ? "success" : "default"}
      href="/admin/vendas"
    />,
    <StatCard
      key="revenue"
      label="Faturamento total"
      value={formatCurrencyBRL(sales.revenue)}
      hint={`${sales.count} venda(s) registrada(s)`}
    />,
    <StatCard
      key="ticket"
      label="Ticket médio"
      value={sales.count > 0 ? formatCurrencyBRL(sales.ticket) : "—"}
      hint="Média por venda fechada"
    />,
    <StatCard
      key="avg-km"
      label="KM médio do estoque"
      value={
        vehicles.available > 0
          ? `${formatNumberBR(Math.round(vehicles.averageKm))} km`
          : "—"
      }
      hint="Somente veículos disponíveis"
    />,
    <StatCard
      key="featured"
      label="Em destaque na vitrine"
      value={vehicles.featured}
      hint={
        vehicles.featured === 0
          ? "A home fica vazia até você marcar destaques"
          : `${vehicles.featured}/8 na home · ordem pelo cadastro`
      }
      tone={alerts.noFeatured ? "warning" : "default"}
      href="/admin/veiculos?tab=destaques"
    />,
  ];

  return (
    <div className="space-y-4 sm:space-y-8">
      <AdminPageHeader
        title="Dashboard"
        subtitle="Resumo da loja hoje."
        mobileActions="row"
        actions={
          <>
            <Link href="/admin/veiculos/novo" className={btn.primary}>
              <IconPlus className="h-4 w-4" />
              Novo veículo
            </Link>
            <Link href="/admin/vendas" className={btn.outline}>
              <span className="sm:hidden">Venda</span>
              <span className="hidden sm:inline">Registrar venda</span>
            </Link>
          </>
        }
      />

      {/* Celular: 2 números que pedem ação; o resto fica em “Mais números”. */}
      <section className="space-y-3 lg:hidden" aria-label="Números da loja">
        <div className={adminStatGrid}>
          {leadsCard}
          {availableCard}
        </div>
        <details className="group border border-white/10 bg-ink/50">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-sm text-cream touch-manipulation [&::-webkit-details-marker]:hidden">
            <span className="font-display text-xs font-semibold uppercase tracking-wider">
              Mais números
            </span>
            <span className="flex items-center gap-2 text-xs text-muted">
              Estoque, vendas, ticket
              <IconChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </span>
          </summary>
          <div className={`${adminStatGrid} border-t border-white/10 p-3`}>
            {secondaryCards}
          </div>
        </details>
      </section>

      <section className="hidden space-y-4 lg:block" aria-label="Números da loja">
        <div className={adminStatGrid}>
          {availableCard}
          {secondaryCards[0]}
          {leadsCard}
          {secondaryCards[1]}
        </div>
        <div className={adminStatGrid}>{secondaryCards.slice(2)}</div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title={`Pendências${alertList.length > 0 ? ` (${alertList.length})` : ""}`}
          action={
            alertList.length === 0 ? (
              <Badge tone="success">Tudo em ordem</Badge>
            ) : null
          }
        >
          {alertList.length === 0 ? (
            <p className="text-sm text-muted">
              Nenhuma pendência: estoque com fotos, destaques definidos e dados
              da loja preenchidos.
            </p>
          ) : (
            <>
              <ul className="space-y-2.5 text-sm">
                {alertHead.map((alert) => (
                  <AlertRow key={alert.key} alert={alert} />
                ))}
              </ul>
              {alertRest.length > 0 ? (
                <details className="group mt-2.5">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-center gap-2 border border-dashed border-white/15 text-xs uppercase tracking-wider text-muted touch-manipulation hover:text-cream [&::-webkit-details-marker]:hidden">
                    <span className="group-open:hidden">
                      Ver mais {alertRest.length}
                    </span>
                    <span className="hidden group-open:inline">Mostrar menos</span>
                    <IconChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="mt-2.5 space-y-2.5 text-sm">
                    {alertRest.map((alert) => (
                      <AlertRow key={alert.key} alert={alert} />
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          )}
        </Card>

        <Card
          title="Leads"
          action={
            <Link
              href="/admin/leads"
              className="inline-flex min-h-[44px] items-center text-xs text-brand hover:underline"
            >
              Ver todos
            </Link>
          }
        >
          {leads.total === 0 ? (
            <p className="text-sm text-muted">
              Nenhum lead ainda. Os pedidos de avaliação enviados na página
              Vender/Trocar aparecem aqui.
            </p>
          ) : (
            <>
              <ul
                className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label="Leads por status"
              >
                {LEAD_STATUSES.map((status) => (
                  <li key={status} className="shrink-0">
                    <Link
                      href={`/admin/leads?status=${status}`}
                      className={`flex min-h-[44px] items-center gap-2 border px-3 text-xs transition touch-manipulation hover:border-brand/50 ${
                        status === "novo" && leads.byStatus[status] > 0
                          ? "border-brand/50 text-cream"
                          : "border-white/10 text-muted"
                      }`}
                    >
                      <span className="uppercase tracking-wider">
                        {LEAD_STATUS_LABEL[status]}
                      </span>
                      <span className="font-display text-sm font-bold tabular-nums text-cream">
                        {leads.byStatus[status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {leads.recent.length > 0 ? (
                <ul className="mt-3 divide-y divide-white/10 border-t border-white/10">
                  {leads.recent.map((lead, index) => (
                    <li key={lead.id} className={index >= 3 ? "hidden sm:block" : undefined}>
                      <Link
                        href="/admin/leads"
                        className="flex min-h-[56px] items-center justify-between gap-3 py-3 touch-manipulation last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-cream">
                            {lead.name}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {formatPhoneBR(lead.phone)} · {lead.vehicleInfo}
                          </p>
                        </div>
                        <Badge tone={lead.status === "novo" ? "brand" : "neutral"}>
                          {LEAD_STATUS_LABEL[
                            lead.status as keyof typeof LEAD_STATUS_LABEL
                          ] ?? lead.status}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </Card>
      </div>

      <Card
        className="hidden sm:block"
        title="Últimos veículos cadastrados"
        action={
          <Link
            href="/admin/veiculos"
            className="inline-flex min-h-[44px] items-center text-xs text-brand hover:underline"
          >
            Gerenciar
          </Link>
        }
      >
        {data.recentVehicles.length === 0 ? (
          <EmptyState
            title="Nenhum veículo cadastrado"
            description="Cadastre o primeiro veículo para o estoque aparecer no site."
            action={
              <Link href="/admin/veiculos/novo" className={btn.primary}>
                <IconPlus className="h-4 w-4" />
                Cadastrar veículo
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-white/10 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:divide-y-0">
            {data.recentVehicles.map((vehicle) => (
              <li key={vehicle.id} className="flex items-center gap-1 py-1">
                <Link
                  href={`/admin/veiculos/${vehicle.id}`}
                  className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-2 touch-manipulation"
                >
                  <div className="relative h-12 w-16 shrink-0 overflow-hidden bg-asphalt">
                    <VehicleImage
                      src={coverSrc(vehicle.photos)}
                      alt={`${vehicle.brand} ${vehicle.model}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-cream">
                      {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="text-xs text-muted">
                      {vehicle.yearModel} · {formatCurrencyBRL(vehicle.price)}
                    </p>
                  </div>
                </Link>
                <Link
                  href={vehiclePath(vehicle)}
                  target="_blank"
                  aria-label="Ver no site"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-muted transition touch-manipulation hover:text-cream"
                >
                  <IconExternal className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AlertRow({ alert }: { alert: DashboardAlert }) {
  const color =
    alert.tone === "brand"
      ? "text-brand"
      : alert.tone === "warning"
        ? "text-brand-orange"
        : "text-muted";

  return (
    <li>
      <Link
        href={alert.href}
        className="flex min-h-[48px] items-center gap-3 border border-white/10 px-3 py-2.5 transition touch-manipulation hover:border-brand/50 sm:items-start"
      >
        <span className={`mt-0.5 shrink-0 ${color}`}>{ALERT_ICON[alert.icon]}</span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-cream">{alert.title}</span>
          <span className="mt-0.5 hidden text-xs leading-relaxed text-muted sm:block">
            {alert.description}
          </span>
        </span>
      </Link>
    </li>
  );
}
