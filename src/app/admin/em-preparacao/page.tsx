import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, btn } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatAdminMoney } from "@/lib/admin-money";
import { deletePreparationAction } from "./actions";
import { PreparationForm } from "./PreparationForm";

export const dynamic = "force-dynamic";

export default async function EmPreparacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const { ok, erro } = await searchParams;
  const items = await prisma.preparationVehicle.findMany({
    orderBy: [{ createdAt: "desc" }],
  });

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
        {items.map((item) => (
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.ready ? (
                <Link
                  href={`/admin/veiculos/novo?prep=${encodeURIComponent(item.id)}`}
                  className={btn.primary}
                >
                  Criar anúncio
                </Link>
              ) : null}
              <form action={deletePreparationAction}>
                <input type="hidden" name="id" value={item.id} />
                <button type="submit" className={btn.danger}>
                  Excluir
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
