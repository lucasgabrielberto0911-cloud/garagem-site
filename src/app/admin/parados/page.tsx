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
import { STOCK_AGE_BANDS } from "@/lib/admin-stock-age";
import { getSession } from "@/lib/auth";
import { formatCurrencyBRL } from "@/lib/format";

export const dynamic = "force-dynamic";

const bandSuggestion = (id: "60+" | "46-60" | "31-45") =>
  STOCK_AGE_BANDS.find((band) => band.id === id)?.suggestion ?? "";

export default async function AdminParadosPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const report = await getAdminParkedVehicles();
  const count60 = report.bandCounts["60+"];
  const count46 = report.bandCounts["46-60"];
  const count31 = report.bandCounts["31-45"];
  const count0 = report.bandCounts["0-30"];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Carros parados"
        subtitle={`Veículos disponíveis há mais de ${PARKED_MIN_DAYS} dias, organizados por faixa de urgência. ${
          count0 > 0
            ? `${count0} ${count0 === 1 ? "carro está" : "carros estão"} dentro de 0–30 dias.`
            : ""
        }`.trim()}
        actions={
          <Link href="/admin/veiculos?status=disponivel" className={btn.outline}>
            Ver estoque
          </Link>
        }
      />

      {report.items.length === 0 ? (
        <ParkedVehiclesList
          items={report.items}
          viewsAvailable={report.viewsAvailable}
        />
      ) : (
        <>
          <section
            aria-label="Resumo de carros parados por faixa"
            className={adminStatGrid}
          >
            <StatCard
              label="60+ dias"
              value={count60}
              tone={count60 > 0 ? "brand" : "default"}
              hint={bandSuggestion("60+")}
              href={count60 > 0 ? "#faixa-60+" : undefined}
            />
            <StatCard
              label="46–60 dias"
              value={count46}
              hint={bandSuggestion("46-60")}
              href={count46 > 0 ? "#faixa-46-60" : undefined}
            />
            <StatCard
              label="31–45 dias"
              value={count31}
              hint={bandSuggestion("31-45")}
              href={count31 > 0 ? "#faixa-31-45" : undefined}
            />
            <StatCard
              label="Valor anunciado"
              value={formatCurrencyBRL(report.totalValue)}
              hint={`${report.items.length} ${
                report.items.length === 1 ? "carro parado" : "carros parados"
              } · ${count0} em 0–30d`}
            />
          </section>

          <ParkedVehiclesList
            items={report.items}
            viewsAvailable={report.viewsAvailable}
          />
        </>
      )}
    </div>
  );
}
