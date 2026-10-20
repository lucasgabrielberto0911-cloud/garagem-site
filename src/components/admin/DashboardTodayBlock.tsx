import Link from "next/link";
import { formatCurrencyBRL, formatPhoneBR } from "@/lib/format";
import { leadDisplayName } from "@/lib/leads";
import { Badge } from "@/components/admin/ui";
import { IconCash } from "@/components/admin/icons";
import { IconPhone } from "@/components/site/icons";

export type TodayBlockProps = {
  dueLeads: Array<{
    id: string;
    name: string;
    phone?: string | null;
    nextAction?: string | null;
    nextActionAt?: Date | string | null;
    vehicleInfo?: string | null;
  }>;
  unansweredLeads: Array<{
    id: string;
    name: string;
    phone?: string | null;
    vehicleInfo?: string | null;
    createdAt: Date | string;
  }>;
  reservedVehicles: Array<{
    id: string;
    brand: string;
    model: string;
    price: number;
    updatedAt: Date | string;
  }>;
};

function formatHoursAgo(dateInput: Date | string): string {
  const diffMs = Date.now() - new Date(dateInput).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours <= 1) return "há 1h";
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function formatDaysReserved(dateInput: Date | string): string {
  const diffMs = Date.now() - new Date(dateInput).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

export function DashboardTodayBlock({
  dueLeads,
  unansweredLeads,
  reservedVehicles,
}: TodayBlockProps) {
  const totalPending =
    dueLeads.length + unansweredLeads.length + reservedVehicles.length;

  return (
    <section
      aria-label="Prioridades de hoje"
      className="border border-white/10 bg-ink p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-cream sm:text-lg">
            Hoje
          </h2>
          <p className="text-xs text-muted">
            Prioridades do dia: quem chamar e o que resolver
          </p>
        </div>
        {totalPending > 0 ? (
          <Badge tone="warning">{totalPending} prioridade(s)</Badge>
        ) : (
          <Badge tone="success">Tudo em dia</Badge>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Retornos agendados */}
        <div className="border border-white/5 bg-asphalt/60 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-cream">
              Retornos ({dueLeads.length})
            </span>
            <Link
              href="/admin/agenda"
              className="text-xs text-brand hover:underline"
            >
              Agenda
            </Link>
          </div>
          {dueLeads.length === 0 ? (
            <p className="mt-3 text-xs text-muted">
              Nenhum retorno agendado pendente.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {dueLeads.map((lead) => {
                const phoneDigits = lead.phone?.replace(/\D/g, "");
                return (
                  <li
                    key={lead.id}
                    className="flex flex-col justify-between gap-1 rounded border border-white/5 bg-ink/40 p-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/leads?lead=${lead.id}`}
                        className="font-medium text-cream hover:underline truncate"
                      >
                        {leadDisplayName(lead)}
                      </Link>
                      {phoneDigits ? (
                        <a
                          href={`https://wa.me/55${phoneDigits}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[32px] items-center gap-1 rounded bg-brand/10 px-2 py-1 text-xs font-medium text-brand hover:bg-brand/20 touch-manipulation"
                          title="Chamar no WhatsApp"
                        >
                          <IconPhone className="h-3 w-3" />
                          WhatsApp
                        </a>
                      ) : null}
                    </div>
                    {lead.vehicleInfo ? (
                      <p className="truncate text-muted">{lead.vehicleInfo}</p>
                    ) : null}
                    {lead.nextAction ? (
                      <p className="text-brand-orange truncate">
                        • {lead.nextAction}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 2. Leads novos sem resposta (> 1h) */}
        <div className="border border-white/5 bg-asphalt/60 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-cream">
              Sem resposta &gt; 1h ({unansweredLeads.length})
            </span>
            <Link
              href="/admin/leads?status=novo"
              className="text-xs text-brand hover:underline"
            >
              Ver novos
            </Link>
          </div>
          {unansweredLeads.length === 0 ? (
            <p className="mt-3 text-xs text-muted">
              Nenhum lead novo esperando resposta.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {unansweredLeads.map((lead) => {
                const phoneDigits = lead.phone?.replace(/\D/g, "");
                return (
                  <li
                    key={lead.id}
                    className="flex flex-col justify-between gap-1 rounded border border-brand/20 bg-brand/5 p-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/admin/leads?lead=${lead.id}`}
                        className="font-medium text-cream hover:underline truncate"
                      >
                        {leadDisplayName(lead)}
                      </Link>
                      <span className="text-xs text-brand-orange font-semibold">
                        {formatHoursAgo(lead.createdAt)}
                      </span>
                    </div>
                    {lead.vehicleInfo ? (
                      <p className="truncate text-muted">{lead.vehicleInfo}</p>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-muted text-xs">
                        {lead.phone ? formatPhoneBR(lead.phone) : "Sem telefone"}
                      </span>
                      {phoneDigits ? (
                        <a
                          href={`https://wa.me/55${phoneDigits}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-[30px] items-center gap-1 bg-brand px-2 py-0.5 text-xs font-semibold text-cream hover:bg-brand/90 touch-manipulation"
                        >
                          Responder
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 3. Carros reservados */}
        <div className="border border-white/5 bg-asphalt/60 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
            <span className="font-display text-xs font-semibold uppercase tracking-wider text-cream">
              Reservados ({reservedVehicles.length})
            </span>
            <Link
              href="/admin/veiculos?status=reservado"
              className="text-xs text-brand hover:underline"
            >
              Estoque
            </Link>
          </div>
          {reservedVehicles.length === 0 ? (
            <p className="mt-3 text-xs text-muted">
              Nenhum carro reservado no estoque.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {reservedVehicles.map((vehicle) => (
                <li
                  key={vehicle.id}
                  className="flex flex-col justify-between gap-1 rounded border border-white/5 bg-ink/40 p-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/admin/veiculos/${vehicle.id}`}
                      className="font-medium text-cream hover:underline truncate"
                    >
                      {vehicle.brand} {vehicle.model}
                    </Link>
                    <span className="text-xs text-muted">
                      {formatDaysReserved(vehicle.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-cream font-medium">
                      {formatCurrencyBRL(vehicle.price)}
                    </span>
                    <Link
                      href={`/admin/vendas?vehicle=${vehicle.id}`}
                      className="inline-flex min-h-[30px] items-center gap-1 border border-brand bg-brand/10 px-2 py-0.5 text-xs font-medium text-cream hover:bg-brand/20 touch-manipulation"
                    >
                      <IconCash className="h-3 w-3" />
                      Vender
                    </Link>
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
