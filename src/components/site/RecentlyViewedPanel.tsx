"use client";

import { useEffect, useState } from "react";
import { VehicleGrid } from "./VehicleGrid";
import { VehicleCardSkeletonGrid } from "./VehicleCardSkeleton";
import type { VehicleCardData } from "./VehicleCard";
import {
  clearRecentVehicles,
  shouldFetchRecentVehicles,
} from "@/lib/recently-viewed";
import { notifyError } from "@/lib/notify";

export function RecentlyViewedPanel({
  ids,
  regionId,
  onClear,
}: {
  ids: string;
  regionId: string;
  onClear: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    attempt: number;
    fetchedAt: number;
    vehicles: VehicleCardData[];
    failed: boolean;
  } | null>(null);
  const hasFreshCache =
    result !== null &&
    !shouldFetchRecentVehicles(result, ids) &&
    result.attempt === attempt;
  const current =
    result?.key === ids && (hasFreshCache || result.attempt === attempt)
      ? result
      : null;

  useEffect(() => {
    if (!ids) return;
    if (
      result &&
      result.key === ids &&
      !result.failed &&
      result.attempt === attempt &&
      !shouldFetchRecentVehicles(result, ids)
    ) {
      return;
    }
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    fetch(`/api/veiculos?ids=${encodeURIComponent(ids)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Histórico indisponível");
        const data = await response.json();
        if (data.error || !Array.isArray(data.vehicles)) {
          throw new Error("Resposta inválida");
        }
        if (active) {
          setResult({
            key: ids,
            attempt,
            fetchedAt: Date.now(),
            vehicles: data.vehicles.slice(0, 4),
            failed: false,
          });
        }
      })
      .catch(() => {
        if (active) {
          setResult({
            key: ids,
            attempt,
            fetchedAt: Date.now(),
            vehicles: [],
            failed: true,
          });
        }
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [ids, attempt, result]);

  useEffect(() => {
    if (!result?.failed) return;
    const onOnline = () => setAttempt((value) => value + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [result?.failed]);

  return (
    <div id={regionId} role="region" aria-label="Vistos recentemente" className="pb-4 pt-3">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1">
        <p className="text-xs leading-relaxed text-cream/80">Seu histórico fica só neste aparelho.</p>
        <button
          type="button"
          className="min-h-11 text-xs text-cream/80 underline underline-offset-4 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
          onClick={() => {
            try {
              clearRecentVehicles();
              onClear();
            } catch {
              notifyError("Não foi possível limpar o histórico neste aparelho.");
            }
          }}
        >
          Limpar histórico
        </button>
      </div>
      {!current ? (
        <VehicleCardSkeletonGrid count={2} />
      ) : current.failed ? (
        <div role="status" className="py-3 text-sm leading-relaxed text-cream/80">
          <p>Não conseguimos consultar esses anúncios agora.</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-3 min-h-11 border border-white/25 px-4 font-semibold text-cream hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
          >
            Tentar novamente
          </button>
        </div>
      ) : current.vehicles.length ? (
        <VehicleGrid vehicles={current.vehicles} desktopCols={4} lgVisibleCount={3} destaqueLimit={0} />
      ) : (
        <p role="status" className="py-3 text-sm leading-relaxed text-cream/80">
          Esses anúncios não estão disponíveis agora. Você pode continuar escolhendo no estoque.
        </p>
      )}
    </div>
  );
}
