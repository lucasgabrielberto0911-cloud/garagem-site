"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { VehicleGrid } from "./VehicleGrid";
import { VehicleCardSkeletonGrid } from "./VehicleCardSkeleton";
import type { VehicleCardData } from "./VehicleCard";
import { clearRecentVehicles, recentIdsSnapshot, RECENT_VEHICLES_EVENT, RECENT_VEHICLES_KEY } from "@/lib/recently-viewed";
import { notifyError } from "@/lib/notify";

function subscribe(changed: () => void) {
  const storage = (event: StorageEvent) => { if (!event.key || event.key === RECENT_VEHICLES_KEY) changed(); };
  window.addEventListener(RECENT_VEHICLES_EVENT, changed);
  window.addEventListener("storage", storage);
  return () => { window.removeEventListener(RECENT_VEHICLES_EVENT, changed); window.removeEventListener("storage", storage); };
}
const serverSnapshot = () => "";

export function RecentlyViewedVehicles() {
  const ids = useSyncExternalStore(subscribe, recentIdsSnapshot, serverSnapshot);
  const regionId = useId();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; vehicles: VehicleCardData[]; failed: boolean } | null>(null);
  const current = result?.key === ids && result.attempt === attempt ? result : null;

  useEffect(() => {
    if (!open || !ids) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    fetch(`/api/veiculos?ids=${encodeURIComponent(ids)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Histórico indisponível");
        const data = await response.json();
        if (data.error || !Array.isArray(data.vehicles)) throw new Error("Resposta inválida");
        if (active) setResult({ key: ids, attempt, vehicles: data.vehicles.slice(0, 4), failed: false });
      })
      .catch(() => { if (active) setResult({ key: ids, attempt, vehicles: [], failed: true }); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [ids, open, attempt]);

  if (!ids) return null;
  return (
    <section data-recent-vehicles="" className="my-5">
      <button type="button" aria-expanded={open} aria-controls={regionId}
        onClick={() => { if (!open) setAttempt(value => value + 1); setOpen(value => !value); }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-ink/40 px-4 py-3 text-left text-sm font-semibold text-cream transition hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
        Vistos recentemente <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div id={regionId} role="region" aria-label="Vistos recentemente" className="pb-4 pt-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
            <p className="text-xs leading-relaxed text-muted">Seu histórico fica só neste aparelho.</p>
            <button type="button" className="min-h-11 text-xs text-muted underline underline-offset-4 hover:text-cream"
              onClick={() => { try { clearRecentVehicles(); setOpen(false); } catch { notifyError("Não foi possível limpar o histórico neste aparelho."); } }}>
              Limpar histórico
            </button>
          </div>
          {!current ? <VehicleCardSkeletonGrid count={2} /> : current.failed ? (
            <div role="status" className="py-3 text-sm leading-relaxed text-muted">
              <p>Não conseguimos consultar esses anúncios agora.</p>
              <button type="button" onClick={() => setAttempt(value => value + 1)} className="mt-3 min-h-11 border border-white/25 px-4 font-semibold text-cream hover:border-brand">Tentar novamente</button>
            </div>
          ) : current.vehicles.length ? <VehicleGrid vehicles={current.vehicles} desktopCols={4} destaqueLimit={0} /> : (
            <p role="status" className="py-3 text-sm leading-relaxed text-muted">Esses anúncios não estão disponíveis agora. Você pode continuar escolhendo no estoque.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
