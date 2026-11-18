import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, btn } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatAdminMoney } from "@/lib/admin-money";
import { getWantedStockMatches } from "@/lib/wanted-stock-match-store";
import { PreparationForm } from "./PreparationForm";
import { PreparationItemActions } from "./PreparationItemActions";

export const dynamic = "force-dynamic";

export default async function EmPreparacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const { ok, erro } = await searchParams;
  const [items, matches] = await Promise.all([
    prisma.preparationVehicle.findMany({
      orderBy: [{ createdAt: "desc" }],
    }),
    getWantedStockMatches(),
  ]);
  const matchesByPrepId = new Map<string, typeof matches>();
  for (const match of matches) {
    const list = matchesByPrepId.get(match.vehicleId);
    if (list) list.push(match);
    else matchesByPrepId.set(match.vehicleId, [match]);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Em preparação"
        subtitle="Carros comprados que ainda estão sendo preparados. Nada daqui aparece no site."
        actions={
          <a
            href="/api/admin/em-preparacao/pdf"
            target="_blank"
            rel="noopener"
            className={btn.outline}
          >
            Gerar PDF
          </a>
        }
      />
      {ok ? (
        <p role="status" className="border border-white/10 p-3 text-sm text-cream">
          {ok}
        </p>
      ) : null}
      {erro ? (
        <p role="alert" className="border border-brand/60 p-3 text-sm text-red-400">
          {erro}
        </p>
      ) : null}

      <details className="border border-white/10 p-4">
        <summary className="cursor-pointer font-display text-sm font-semibold text-cream">
          Adicionar carro
        </summary>
        <div className="mt-4">
          <PreparationForm />
        </div>
      </details>

      {items.length === 0 ? (
        <p className="text-sm text-muted">Nenhum carro em preparação.</p>
      ) : null}
      <ul className="space-y-3">
        {items.map((item) => {
          const itemMatches = matchesByPrepId.get(item.id) ?? [];
          return (
          <li key={item.id} className="border border-white/10 p-4">
            <details>
              <summary className="cursor-pointer">
                <span className="font-display font-semibold text-cream">
                  {item.brand} {item.model}
                </span>
                <span className="ml-2 text-xs text-muted">
                  {[
                    item.color,
                    item.year,
                    item.plate,
                    item.purchasePrice != null
                      ? formatAdminMoney(item.purchasePrice)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="ml-2 text-xs text-cream">
                  {item.ready ? "Pronto" : "Em preparo"}
                  {item.posted ? " · Postado" : ""}
                </span>
              </summary>
              <div className="mt-4">
                <PreparationForm item={item} />
              </div>
            </details>
            {itemMatches.length > 0 ? (
              <div className="mt-3 border border-brand/40 bg-brand/10 p-3 text-xs text-cream">
                <p className="font-semibold">
                  {itemMatches.length === 1
                    ? "1 pedido em aberto compatível:"
                    : `${itemMatches.length} pedidos em aberto compatíveis:`}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {itemMatches.map((match) => (
                    <li key={match.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Link
                        href={match.href}
                        className="underline underline-offset-4 hover:text-brand-light"
                      >
                        {match.title} ({match.criteria})
                      </Link>
                      {match.whatsappHref ? (
                        <a
                          href={match.whatsappHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cream/85 underline underline-offset-4 hover:text-cream"
                        >
                          Chamar no WhatsApp
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <PreparationItemActions id={item.id} ready={item.ready} />
          </li>
          );
        })}
      </ul>
    </div>
  );
}
