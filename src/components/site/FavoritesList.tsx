"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { VehicleCardData } from "@/components/site/VehicleCard";
import { VehicleCardSkeletonGrid } from "@/components/site/VehicleCardSkeleton";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { WhatsAppButton } from "@/components/site/ui";
import { useFavorites } from "@/lib/favorites";
import { WHATSAPP_MESSAGES } from "@/lib/site";

export function FavoritesList() {
  const { ids, ready, clear } = useFavorites();
  const [vehicles, setVehicles] = useState<VehicleCardData[] | null>(null);
  const [failed, setFailed] = useState(false);

  const key = ids.join(",");

  useEffect(() => {
    if (!ready) return;

    if (!key) {
      setVehicles([]);
      return;
    }

    let active = true;
    setFailed(false);

    fetch(`/api/veiculos?ids=${encodeURIComponent(key)}`)
      .then((response) => response.json())
      .then((data) => {
        if (active) setVehicles(data.vehicles ?? []);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setVehicles([]);
        }
      });

    return () => {
      active = false;
    };
  }, [key, ready]);

  if (!ready || vehicles === null) {
    return <VehicleCardSkeletonGrid count={4} />;
  }

  if (failed) {
    return (
      <div className="mx-auto max-w-2xl border border-dashed border-white/15 bg-ink/40 px-6 py-16 text-center">
        <p className="font-display text-lg font-semibold text-cream">
          Não conseguimos carregar seus favoritos
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Verifique sua conexão e tente de novo.
        </p>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="mx-auto max-w-2xl border border-dashed border-white/15 bg-ink/40 px-6 py-16 text-center">
        <p className="font-display text-lg font-semibold text-cream">
          Você ainda não salvou nenhum veículo
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Toque no coração dos veículos que te interessam e eles ficam guardados
          aqui, neste aparelho, para você comparar depois.
        </p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Link
            href="/estoque"
            className="inline-flex min-h-[48px] items-center justify-center bg-brand px-6 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] sm:text-sm"
          >
            Ver estoque
          </Link>
          <WhatsAppButton message={WHATSAPP_MESSAGES.general} variant="outline">
            Falar com um consultor
          </WhatsAppButton>
        </div>
      </div>
    );
  }

  const missing = ids.length - vehicles.length;

  return (
    <div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-wider text-muted">
          {vehicles.length} {vehicles.length === 1 ? "veículo salvo" : "veículos salvos"}
          {missing > 0
            ? ` · ${missing} ${missing === 1 ? "saiu" : "saíram"} do estoque`
            : ""}
        </p>
        <button
          type="button"
          onClick={clear}
          className="min-h-[40px] text-xs uppercase tracking-wider text-muted underline-offset-4 transition hover:text-cream hover:underline"
        >
          Limpar favoritos
        </button>
      </div>

      <div className="mt-6">
        <VehicleGrid vehicles={vehicles} />
      </div>

      <div className="mx-auto mt-12 max-w-2xl border border-brand/40 bg-ink p-8 text-center">
        <p className="font-display text-base font-semibold text-cream">
          Quer condições para um desses?
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
          Manda a lista no WhatsApp que a gente monta a proposta com as opções de
          pagamento e avaliação do seu usado.
        </p>
        <WhatsAppButton
          className="mt-5"
          size="lg"
          message={`Olá! Separei alguns veículos no site: ${vehicles
            .map((vehicle) => `${vehicle.brand} ${vehicle.model} ${vehicle.yearModel}`)
            .join(", ")}. Pode me passar as condições?`}
        >
          Enviar minha lista
        </WhatsAppButton>
      </div>
    </div>
  );
}
