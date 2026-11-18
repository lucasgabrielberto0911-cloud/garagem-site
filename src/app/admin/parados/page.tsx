import Link from "next/link";
import { redirect } from "next/navigation";
import { ParkedVehiclesList } from "@/components/admin/ParkedVehiclesList";
import {
  AdminPageHeader,
  StatCard,
  adminStatGrid,
  btn,
} from "@/components/admin/ui";
import { PARKED_MIN_DAYS } from "@/lib/admin-parados";
import { getAdminParkedVehicles } from "@/lib/admin-parados-store";
import { getSession } from "@/lib/auth";
import { formatCurrencyBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CarrosParadosPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  let report: Awaited<ReturnType<typeof getAdminParkedVehicles>> | null = null;
  try {
    report = await getAdminParkedVehicles();
  } catch (error) {
    console.error("[admin/parados]", error);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Carros parados"
        subtitle={`Veículos disponíveis no estoque há mais de ${PARKED_MIN_DAYS} dias.`}
        actions={
          <Link href="/admin/veiculos?status=disponivel" className={btn.outline}>
            Todos os disponíveis
          </Link>
        }
      />

      {!report ? (
        <p
          role="alert"
          className="border border-brand/60 bg-brand/10 p-4 text-sm text-cream"
        >
          Não foi possível consultar os veículos parados agora. Tente recarregar
          a página.
        </p>
      ) : (
        <>
          {report.items.length > 0 ? (
            <section className={adminStatGrid} aria-label="Resumo dos parados">
              <StatCard
                label={`Acima de ${PARKED_MIN_DAYS} dias`}
                value={report.items.length}
                hint="Somente veículos disponíveis"
                tone="brand"
              />
              <StatCard
                label="Maior tempo parado"
                value={`${report.items[0].daysParked} dias`}
                hint={report.items[0].name}
              />
              <StatCard
                label="Valor anunciado"
                value={formatCurrencyBRL(report.totalValue)}
                hint="Soma dos preços de vitrine"
              />
            </section>
          ) : null}

          <ParkedVehiclesList
            items={report.items}
            viewsAvailable={report.viewsAvailable}
          />
        </>
      )}
    </div>
  );
}
