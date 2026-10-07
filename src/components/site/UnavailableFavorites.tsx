"use client";

import { snapshotsForIds } from "@/lib/offline-queue";
import { formatVehicleLabel } from "@/lib/format";
import { notifyError } from "@/lib/notify";

export function UnavailableFavorites({ ids, remove }: { ids: string[]; remove: (id: string) => void }) {
  if (!ids.length) return null;
  const snapshots = snapshotsForIds(ids);
  return (
    <section className="my-6 rounded-xl border border-white/15 bg-ink/40 p-4 sm:p-5" aria-label="Favoritos indisponíveis">
      <h2 className="font-display text-base font-semibold text-cream">Indisponíveis no estoque atual</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">Você pode tirar só estes da sua lista. Os outros favoritos continuam salvos.</p>
      <ul className="mt-3 divide-y divide-white/10">
        {ids.map((id, index) => {
          const saved = snapshots.find(vehicle => vehicle.id === id);
          const label = saved ? formatVehicleLabel(saved.brand, saved.model, saved.yearModel) : "Veículo salvo " + (index + 1);
          return <li key={id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0 text-left"><p className="break-words text-sm font-semibold leading-relaxed text-cream">{label}</p>
              <p className="mt-1 text-xs text-muted">{saved ? "Identificação salva neste aparelho" : "Anúncio fora da lista atual"}</p></div>
            <button type="button" aria-label={`Remover ${label} dos favoritos indisponíveis`}
              onClick={() => { try { remove(id); } catch { notifyError("Não foi possível remover o favorito neste aparelho. Tente novamente."); } }}
              className="min-h-11 shrink-0 rounded-lg border border-white/20 px-3 text-xs font-semibold text-cream transition hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">Remover</button>
          </li>;
        })}
      </ul>
    </section>
  );
}
