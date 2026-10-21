import { redirect } from "next/navigation";
import { AdminPageHeader, btn, inputClass } from "@/components/admin/ui";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { localDateInput } from "@/lib/admin-date";
import { formatAdminMoney } from "@/lib/admin-money";
import { deletePreparationAction, movePreparationToStockAction, publishPreparedVehicleAction, savePreparationAction } from "./actions";

export const dynamic = "force-dynamic";

type Item = Awaited<ReturnType<typeof prisma.preparationVehicle.findMany>>[number];

function Fields({ item }: { item?: Item }) {
  const text = "grid gap-1 text-xs text-muted";
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <label className={text}>Marca<input name="brand" required defaultValue={item?.brand} className={inputClass} /></label>
      <label className={text}>Modelo/Versão<input name="model" required defaultValue={item?.model} className={inputClass} /></label>
      <label className={text}>Cor<input name="color" defaultValue={item?.color ?? ""} className={inputClass} /></label>
      <label className={text}>Ano<input name="year" inputMode="numeric" defaultValue={item?.year ?? ""} className={inputClass} /></label>
      <label className={text}>KM<input name="km" inputMode="numeric" defaultValue={item?.km ?? ""} className={inputClass} /></label>
      <label className={text}>Placa<input name="plate" defaultValue={item?.plate ?? ""} className={inputClass} /></label>
      <label className={text}>Data da compra<input name="purchasedAt" type="date" defaultValue={item?.purchasedAt ? localDateInput(item.purchasedAt) : ""} className={inputClass} /></label>
      <label className={text}>Valor de compra<input name="purchasePrice" inputMode="decimal" placeholder="R$" defaultValue={item?.purchasePrice ?? ""} className={inputClass} /></label>
      <label className="flex items-center gap-2 text-sm text-cream"><input type="checkbox" name="ready" defaultChecked={item?.ready} /> Pronto</label>
      <label className="flex items-center gap-2 text-sm text-cream"><input type="checkbox" name="posted" defaultChecked={item?.posted} /> Postado</label>
    </div>
  );
}

export default async function EmPreparacaoPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  const { ok, erro } = await searchParams;
  const items = await prisma.preparationVehicle.findMany({ orderBy: [{ createdAt: "desc" }] });
  const drafts = await prisma.vehicle.findMany({
    where: { historical: true, sale: null, status: "disponivel", price: { lte: 0 } },
    orderBy: { createdAt: "desc" },
    select: { id: true, brand: true, model: true, year: true, plate: true },
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminPageHeader
        title="Em preparação"
        subtitle="Carros comprados que ainda estão sendo preparados. Nada daqui aparece no site."
        actions={<a href="/api/admin/em-preparacao/pdf" target="_blank" rel="noopener" className={btn.outline}>Gerar PDF</a>}
      />
      {ok ? <p role="status" className="border border-white/10 p-3 text-sm text-cream">{ok}</p> : null}
      {erro ? <p role="alert" className="border border-brand/60 p-3 text-sm text-red-400">{erro}</p> : null}

      <details className="border border-white/10 p-4">
        <summary className="cursor-pointer font-display text-sm font-semibold text-cream">Adicionar carro</summary>
        <form action={savePreparationAction} className="mt-4 space-y-4">
          <Fields />
          <button className={btn.primary}>Cadastrar</button>
        </form>
      </details>

      {drafts.length > 0 ? (
        <section className="space-y-3 border border-white/10 p-4">
          <h2 className="font-display text-sm font-semibold text-cream">Aguardando publicação</h2>
          <p className="text-xs text-muted">Movidos para o estoque, ocultos até completar a ficha (preço e fotos) e publicar.</p>
          <ul className="space-y-2">
            {drafts.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 text-sm text-cream">
                <span>{v.brand} {v.model} {v.year} {v.plate ?? ""}</span>
                <a href={`/admin/veiculos/${v.id}`} className={btn.outline}>Completar ficha</a>
                <form action={publishPreparedVehicleAction}>
                  <input type="hidden" name="id" value={v.id} />
                  <button className={btn.primary}>Publicar</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items.length === 0 ? <p className="text-sm text-muted">Nenhum carro em preparação.</p> : null}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.id} className="border border-white/10 p-4">
            <details>
              <summary className="cursor-pointer">
                <span className="font-display font-semibold text-cream">{item.brand} {item.model}</span>
                <span className="ml-2 text-xs text-muted">
                  {[item.color, item.year, item.plate, item.purchasePrice != null ? formatAdminMoney(item.purchasePrice) : null].filter(Boolean).join(" · ")}
                </span>
                <span className="ml-2 text-xs text-cream">{item.ready ? "Pronto" : "Em preparo"}{item.posted ? " · Postado" : ""}</span>
              </summary>
              <form action={savePreparationAction} className="mt-4 space-y-4">
                <Fields item={item} />
                <button className={btn.primary}>Salvar</button>
              </form>
            </details>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.ready ? (
                <form action={movePreparationToStockAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className={btn.outline}>Mover para o estoque</button>
                </form>
              ) : null}
              <form action={deletePreparationAction}>
                <input type="hidden" name="id" value={item.id} />
                <button className={btn.danger}>Excluir</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
