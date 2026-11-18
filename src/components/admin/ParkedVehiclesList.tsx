import Link from "next/link";
import { adminDate } from "@/lib/admin-date";
import { PARKED_MIN_DAYS, type ParkedVehicleItem } from "@/lib/admin-parados";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { IconClock, IconExternal, IconPencil } from "@/components/admin/icons";
import { Badge, EmptyState, btn, iconTap } from "@/components/admin/ui";

export function ParkedVehiclesList({
  items,
  viewsAvailable = true,
}: {
  items: readonly ParkedVehicleItem[];
  viewsAvailable?: boolean;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<IconClock className="h-8 w-8" />}
        title={`Nenhum carro parado há mais de ${PARKED_MIN_DAYS} dias`}
        description={`Todos os veículos disponíveis entraram no estoque nos últimos ${PARKED_MIN_DAYS} dias.`}
        action={
          <Link href="/admin/veiculos?status=disponivel" className={btn.outline}>
            Ver veículos disponíveis
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul
        className="divide-y divide-white/15 border border-white/15 bg-ink/50 lg:hidden"
        aria-label="Carros parados"
      >
        {items.map((item) => {
          const enteredLabel = adminDate(new Date(item.enteredAt), {
            dateStyle: "short",
          });
          const priceLabel =
            item.price > 0 ? formatCurrencyBRL(item.price) : "Sem preço";
          const viewsLabel = viewsAvailable ? formatNumberBR(item.views) : "—";

          return (
            <li key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/admin/veiculos/${item.id}`}
                  className="inline-flex min-h-[44px] min-w-0 flex-1 items-center font-display text-base font-semibold text-cream transition touch-manipulation hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="break-words">{item.name}</span>
                </Link>
                <Link
                  href={item.publicPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver ${item.name} no site`}
                  className={iconTap}
                >
                  <IconExternal className="h-4 w-4" />
                </Link>
              </div>

              <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
                <div className="min-w-0">
                  <dt className="text-xs text-cream/75">Dias parado</dt>
                  <dd className="mt-1">
                    <Badge
                      tone={item.daysParked >= 60 ? "brand" : "neutral"}
                      className="tabular-nums"
                    >
                      {item.daysParked} dias
                    </Badge>
                    <span className="mt-1 block text-[11px] tabular-nums text-cream/70">
                      Desde {enteredLabel}
                    </span>
                  </dd>
                </div>

                <div className="min-w-0">
                  <dt className="text-xs text-cream/75">Preço</dt>
                  <dd className="mt-1 break-words font-display text-sm font-semibold tabular-nums text-cream">
                    {priceLabel}
                  </dd>
                </div>

                <div className="min-w-0">
                  <dt className="text-xs text-cream/75">Visualizações</dt>
                  <dd className="mt-1 font-display text-sm font-semibold tabular-nums text-cream">
                    {viewsLabel}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto border border-white/15 bg-ink/50 lg:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/15 font-display text-xs font-semibold uppercase tracking-wider text-cream/80">
              <th scope="col" className="px-5 py-3.5">
                Veículo
              </th>
              <th scope="col" className="px-5 py-3.5">
                Dias parado
              </th>
              <th scope="col" className="px-5 py-3.5 text-right">
                Preço
              </th>
              <th scope="col" className="px-5 py-3.5 text-right">
                Visualizações
              </th>
              <th scope="col" className="px-5 py-3.5 text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/15">
            {items.map((item) => {
              const enteredLabel = adminDate(new Date(item.enteredAt), {
                dateStyle: "short",
              });
              const priceLabel =
                item.price > 0 ? formatCurrencyBRL(item.price) : "Sem preço";
              const viewsLabel = viewsAvailable
                ? formatNumberBR(item.views)
                : "—";

              return (
                <tr
                  key={item.id}
                  className="transition hover:bg-white/[0.03]"
                >
                  <td className="px-5 py-3.5 font-display font-semibold text-cream">
                    <Link
                      href={`/admin/veiculos/${item.id}`}
                      className="inline-flex min-h-[44px] items-center hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        tone={item.daysParked >= 60 ? "brand" : "neutral"}
                        className="tabular-nums"
                      >
                        {item.daysParked} dias
                      </Badge>
                      <span className="text-xs tabular-nums text-cream/75">
                        Desde {enteredLabel}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-right font-display font-semibold tabular-nums text-cream">
                    {priceLabel}
                  </td>
                  <td className="px-5 py-3.5 text-right font-display font-semibold tabular-nums text-cream">
                    {viewsLabel}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/veiculos/${item.id}`}
                        aria-label={`Editar ${item.name}`}
                        className={iconTap}
                      >
                        <IconPencil className="h-4 w-4" />
                      </Link>
                      <Link
                        href={item.publicPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Ver ${item.name} no site`}
                        className={iconTap}
                      >
                        <IconExternal className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-cream/75">
        Ordenado por dias em estoque (maior para menor). Visualizações somam os
        acessos à ficha no site registrados com consentimento de medição.
      </p>
    </div>
  );
}
