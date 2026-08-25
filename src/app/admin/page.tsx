import Link from "next/link";
import { redirect } from "next/navigation";
import { VehicleImage } from "@/components/VehicleImage";
import {
  IconAlert,
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
import { daysInStock, getDashboardData, STALE_DAYS } from "@/lib/admin-stats";
import { formatCurrencyBRL, formatNumberBR, formatPhoneBR } from "@/lib/format";
import { LEAD_STATUS_LABEL, LEAD_STATUSES } from "@/lib/leads";
import { vehiclePath } from "@/lib/vehicle-slug";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const data = await getDashboardData();
  const { vehicles, sales, leads, alerts } = data;

  const alertCount =
    alerts.staleVehicles.length +
    alerts.withoutPhotos.length +
    (alerts.withoutVideo.length > 0 ? 1 : 0) +
    (alerts.noFeatured ? 1 : 0) +
    (alerts.noTestimonials ? 1 : 0) +
    (alerts.noGoogleReviews ? 1 : 0) +
    (alerts.usingSeedPassword ? 1 : 0) +
    (alerts.placeholders.length > 0 ? 1 : 0);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Dashboard"
        subtitle={`Olá, ${session.email}. Aqui está o resumo da loja hoje.`}
        actions={
          <>
            <Link href="/admin/veiculos/novo" className={btn.primary}>
              <IconPlus className="h-4 w-4" />
              Novo veículo
            </Link>
            <Link href="/admin/vendas" className={btn.outline}>
              Registrar venda
            </Link>
          </>
        }
      />

      <section className={adminStatGrid}>
        <StatCard
          label="Disponíveis"
          value={vehicles.available}
          hint={`${vehicles.reserved} reservado(s) · ${vehicles.sold} vendido(s)`}
          href="/admin/veiculos?status=disponivel"
        />
        <StatCard
          label="Valor do estoque"
          value={formatCurrencyBRL(vehicles.stockValue)}
          hint={
            vehicles.available > 0
              ? `Média ${formatCurrencyBRL(vehicles.averagePrice)}`
              : "Nenhum veículo disponível"
          }
        />
        <StatCard
          label="Leads novos"
          value={leads.byStatus.novo}
          hint={`${leads.total} lead(s) no total`}
          tone={leads.byStatus.novo > 0 ? "brand" : "default"}
          href="/admin/leads?status=novo"
        />
        <StatCard
          label="Vendas no mês"
          value={sales.monthCount}
          hint={
            sales.monthCount > 0
              ? formatCurrencyBRL(sales.monthRevenue)
              : "Nenhuma venda registrada"
          }
          tone={sales.monthCount > 0 ? "success" : "default"}
          href="/admin/vendas"
        />
      </section>

      <section className={adminStatGrid}>
        <StatCard
          label="Faturamento total"
          value={formatCurrencyBRL(sales.revenue)}
          hint={`${sales.count} venda(s) registrada(s)`}
        />
        <StatCard
          label="Ticket médio"
          value={sales.count > 0 ? formatCurrencyBRL(sales.ticket) : "—"}
          hint="Média por venda fechada"
        />
        <StatCard
          label="KM médio do estoque"
          value={
            vehicles.available > 0
              ? `${formatNumberBR(Math.round(vehicles.averageKm))} km`
              : "—"
          }
          hint="Somente veículos disponíveis"
        />
        <StatCard
          label="Em destaque na vitrine"
          value={vehicles.featured}
          hint={
            vehicles.featured === 0
              ? "A home mostra os mais recentes"
              : "Aparecem primeiro na home"
          }
          tone={alerts.noFeatured ? "warning" : "default"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title={`Pendências${alertCount > 0 ? ` (${alertCount})` : ""}`}
          action={
            alertCount === 0 ? <Badge tone="success">Tudo em ordem</Badge> : null
          }
        >
          {alertCount === 0 ? (
            <p className="text-sm text-muted">
              Nenhuma pendência: estoque com fotos, destaques definidos e dados
              da loja preenchidos.
            </p>
          ) : (
            <ul className="space-y-3 text-sm">
              {alerts.usingSeedPassword ? (
                <AlertRow
                  tone="brand"
                  icon={<IconAlert className="h-4 w-4" />}
                  title="Senha padrão ainda em uso"
                  description="Um acesso do painel continua com a senha criada na instalação. Troque em Minha conta."
                  href="/admin/conta"
                />
              ) : null}

              {alerts.placeholders.length > 0 ? (
                <AlertRow
                  tone="warning"
                  icon={<IconAlert className="h-4 w-4" />}
                  title="Dados da loja incompletos"
                  description={`Ainda em placeholder: ${alerts.placeholders.join(", ")}.`}
                  href="/admin/site"
                />
              ) : null}

              {alerts.noFeatured ? (
                <AlertRow
                  tone="warning"
                  icon={<IconStar className="h-4 w-4" />}
                  title="Nenhum veículo em destaque"
                  description="Marque os melhores como destaque para eles aparecerem primeiro na home."
                  href="/admin/veiculos?status=disponivel"
                />
              ) : null}

              {alerts.noTestimonials ? (
                <AlertRow
                  tone="neutral"
                  icon={<IconQuote className="h-4 w-4" />}
                  title="Nenhum depoimento publicado"
                  description="A home ainda usa depoimentos de exemplo. Publique os reais em Depoimentos."
                  href="/admin/depoimentos"
                />
              ) : null}

              {alerts.noGoogleReviews ? (
                <AlertRow
                  tone="neutral"
                  icon={<IconStar className="h-4 w-4" />}
                  title="Selo do Google ainda oculto"
                  description="Preencha nota, quantidade e o link do perfil em Site. Sem isso o selo não aparece."
                  href="/admin/site"
                />
              ) : null}

              {alerts.withoutVideo.length > 0 ? (
                <AlertRow
                  tone="neutral"
                  icon={<IconAlert className="h-4 w-4" />}
                  title={
                    alerts.withoutVideo.length === 1
                      ? `${alerts.withoutVideo[0].brand} ${alerts.withoutVideo[0].model} sem vídeo`
                      : `${alerts.withoutVideo.length}+ anúncios sem vídeo`
                  }
                  description="Marque no cadastro quando já tiver vídeo. O site continua com “Pedir vídeo” no WhatsApp."
                  href="/admin/veiculos"
                />
              ) : null}

              {alerts.withoutPhotos.map((vehicle) => (
                <AlertRow
                  key={vehicle.id}
                  tone="brand"
                  icon={<IconImage className="h-4 w-4" />}
                  title={`${vehicle.brand} ${vehicle.model} sem fotos`}
                  description="Anúncios sem foto praticamente não recebem contato."
                  href={`/admin/veiculos/${vehicle.id}`}
                />
              ))}

              {alerts.staleVehicles.map((vehicle) => (
                <AlertRow
                  key={vehicle.id}
                  tone="neutral"
                  icon={<IconAlert className="h-4 w-4" />}
                  title={`${vehicle.brand} ${vehicle.model} há ${daysInStock(vehicle.createdAt)} dias no estoque`}
                  description={`Parado há mais de ${STALE_DAYS} dias. Vale revisar preço ou fotos.`}
                  href={`/admin/veiculos/${vehicle.id}`}
                />
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Leads por status"
          action={
            <Link href="/admin/leads" className="text-xs text-brand hover:underline">
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
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {LEAD_STATUSES.map((status) => (
                <li key={status}>
                  <Link
                    href={`/admin/leads?status=${status}`}
                    className="block min-h-[72px] border border-white/10 px-3 py-2.5 transition touch-manipulation hover:border-brand/50"
                  >
                    <p className="text-[11px] uppercase tracking-wider text-muted">
                      {LEAD_STATUS_LABEL[status]}
                    </p>
                    <p className="mt-1 font-display text-xl font-bold text-cream">
                      {leads.byStatus[status]}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Últimos leads"
          action={
            <Link href="/admin/leads" className="text-xs text-brand hover:underline">
              Ver todos
            </Link>
          }
        >
          {leads.recent.length === 0 ? (
            <p className="text-sm text-muted">Nenhum lead recebido ainda.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {leads.recent.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href="/admin/leads"
                    className="flex min-h-[56px] items-center justify-between gap-3 py-3 touch-manipulation first:pt-0 last:pb-0"
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
          )}
        </Card>

        <Card
          title="Últimos veículos cadastrados"
          action={
            <Link
              href="/admin/veiculos"
              className="text-xs text-brand hover:underline"
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
            <ul className="divide-y divide-white/10">
              {data.recentVehicles.map((vehicle) => (
                <li key={vehicle.id} className="flex items-center gap-1 py-1">
                  <Link
                    href={`/admin/veiculos/${vehicle.id}`}
                    className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 py-2 touch-manipulation"
                  >
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden bg-asphalt">
                      <VehicleImage
                        src={vehicle.photos[0]?.url}
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
    </div>
  );
}

function AlertRow({
  icon,
  title,
  description,
  href,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  tone: "brand" | "warning" | "neutral";
}) {
  const color =
    tone === "brand"
      ? "text-brand"
      : tone === "warning"
        ? "text-brand-orange"
        : "text-muted";

  const content = (
    <div className="flex gap-3">
      <span className={`mt-0.5 shrink-0 ${color}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-cream">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
      </div>
    </div>
  );

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className="block min-h-[52px] border border-white/10 px-3 py-2.5 transition touch-manipulation hover:border-brand/50"
        >
          {content}
        </Link>
      ) : (
        <div className="border border-white/10 px-3 py-2.5">{content}</div>
      )}
    </li>
  );
}
