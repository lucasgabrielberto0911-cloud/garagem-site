"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import type { VehicleCardData } from "@/components/site/VehicleCard";
import { VehicleCardSkeletonGrid } from "@/components/site/VehicleCardSkeleton";
import { VehicleGrid } from "@/components/site/VehicleGrid";
import { ButtonLink, WhatsAppButton } from "@/components/site/ui";
import { useFavorites } from "@/lib/favorites";
import { snapshotsForIds, writeFavoriteSnapshot } from "@/lib/offline-queue";
import { formatCurrencyBRL, formatNumberBR, formatVehicleLabel } from "@/lib/format";
import { trackLead } from "@/lib/meta-pixel";
import { favoritesListWhatsApp, WHATSAPP_MESSAGES } from "@/lib/site";
import { vehiclePath } from "@/lib/vehicle-slug";
import { vehicleLocationLabel } from "@/lib/vehicle-location";

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

    const cached = snapshotsForIds(key.split(",")) as VehicleCardData[];
    if (typeof navigator !== "undefined" && !navigator.onLine && cached.length > 0) {
      setVehicles(cached);
    }

    fetch(`/api/veiculos?ids=${encodeURIComponent(key)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`favoritos ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!active) return;
        const next = (data.vehicles ?? []) as VehicleCardData[];
        setVehicles(next);
        for (const vehicle of next) {
          writeFavoriteSnapshot({
            ...vehicle,
            updatedAt:
              vehicle.updatedAt instanceof Date
                ? vehicle.updatedAt.toISOString()
                : vehicle.updatedAt ?? null,
          });
        }
      })
      .catch(() => {
        if (!active) return;
        if (cached.length > 0) {
          setVehicles(cached);
          setFailed(false);
          return;
        }
        setFailed(true);
        setVehicles([]);
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
          A lista continua salva neste aparelho. Verifique a conexão ou siga
          pelo estoque e pelo WhatsApp.
        </p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <ButtonLink href="/estoque" size="lg" className="w-full sm:w-auto">
            Ver estoque
          </ButtonLink>
          <WhatsAppButton
            className="w-full sm:w-auto"
            size="lg"
            trackingLabel="favoritos-vazio"
            message={WHATSAPP_MESSAGES.similarFavorites}
          >
            Falar no WhatsApp
          </WhatsAppButton>
        </div>
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
          No estoque, toque no coração. O veículo fica guardado neste aparelho,
          sem cadastro.
        </p>
        <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <ButtonLink href="/estoque" size="lg" className="w-full sm:w-auto">
            Ver estoque
          </ButtonLink>
          <WhatsAppButton
            className="w-full sm:w-auto"
            size="lg"
            trackingLabel="favoritos-vazio"
            message={WHATSAPP_MESSAGES.similarFavorites}
            variant="solid"
          >
            Pedir no WhatsApp
          </WhatsAppButton>
          <ChatOpenButton
            source="favoritos-vazio"
            prompt="Quero ajuda para escolher um veículo"
            variant="outline"
            className="w-full sm:w-auto"
          />
        </div>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          O estoque abre a lista. O WhatsApp abre para você dizer o que procura.
        </p>
      </div>
    );
  }

  const ordered = [...vehicles].sort((a, b) => {
    const ai = ids.indexOf(a.id);
    const bi = ids.indexOf(b.id);
    return (ai < 0 ? ids.length : ai) - (bi < 0 ? ids.length : bi);
  });
  const missing = ids.length - ordered.length;
  const compare = ordered.slice(0, 4);

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
          onClick={() => {
            if (window.confirm("Limpar todos os favoritos deste aparelho?")) {
              clear();
            }
          }}
          className="min-h-[40px] text-xs uppercase tracking-wider text-muted underline-offset-4 transition hover:text-cream hover:underline"
        >
          Limpar favoritos
        </button>
      </div>

      {compare.length >= 2 ? (
        <>
          <div className="mt-8 hidden overflow-x-auto border border-white/10 lg:block">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-ink text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Comparar</th>
                {compare.map((vehicle) => (
                  <th key={vehicle.id} className="px-4 py-3 font-display text-cream normal-case tracking-normal">
                    <Link href={vehiclePath(vehicle)} className="hover:text-brand">
                      {formatVehicleLabel(vehicle.brand, vehicle.model)}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 bg-asphalt/40">
              {[
                {
                  label: "Preço",
                  value: (v: VehicleCardData) => formatCurrencyBRL(v.price),
                },
                { label: "Ano", value: (v: VehicleCardData) => String(v.yearModel) },
                {
                  label: "KM",
                  value: (v: VehicleCardData) => `${formatNumberBR(v.km)} km`,
                },
                { label: "Câmbio", value: (v: VehicleCardData) => v.transmission },
                { label: "Combustível", value: (v: VehicleCardData) => v.fuel },
                {
                  label: "Cidade",
                  value: (v: VehicleCardData) =>
                    vehicleLocationLabel(v.locationCity) || "—",
                },
              ].map((row) => (
                <tr key={row.label}>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted">
                    {row.label}
                  </th>
                  {compare.map((vehicle) => (
                    <td key={vehicle.id} className="px-4 py-3 text-cream">
                      {row.value(vehicle)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="-mx-4 mt-8 overflow-x-auto px-4 lg:hidden">
            <p className="mb-3 text-xs uppercase tracking-wider text-muted">
              Comparar os {compare.length} primeiros
            </p>
            <ul className="flex snap-x snap-mandatory gap-3 pb-2">
              {compare.map((vehicle) => (
                <li
                  key={vehicle.id}
                  className="w-[min(78vw,18rem)] shrink-0 snap-start border border-white/10 bg-ink p-4"
                >
                  <Link
                    href={vehiclePath(vehicle)}
                    className="block font-display text-sm font-semibold text-cream"
                  >
                    {formatVehicleLabel(vehicle.brand, vehicle.model)}
                  </Link>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Preço</dt>
                      <dd className="font-display font-semibold text-cream">
                        {formatCurrencyBRL(vehicle.price)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Ano</dt>
                      <dd className="text-cream">{vehicle.yearModel}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">KM</dt>
                      <dd className="text-cream">{formatNumberBR(vehicle.km)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Câmbio</dt>
                      <dd className="text-right text-cream">{vehicle.transmission}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Combustível</dt>
                      <dd className="text-right text-cream">{vehicle.fuel}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Cidade</dt>
                      <dd className="text-right text-cream">
                        {vehicleLocationLabel(vehicle.locationCity) || "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <div className="mt-6">
        <VehicleGrid
          vehicles={ordered}
          returnTo="/favoritos"
          whatsappCampaign="favoritos"
        />
      </div>

      <div className="mx-auto mt-12 max-w-2xl border border-brand/40 bg-ink p-6 text-center sm:p-8">
        <p className="font-display text-base font-semibold text-cream">
          Quer condições para um desses?
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
          Abre o WhatsApp com os veículos que você salvou — modelo e ano. A
          proposta de pagamento e a avaliação do seu usado seguem por lá.
        </p>
        <span
          className="contents"
          onClickCapture={() => {
            trackLead({
              content_ids: ordered.map((vehicle) => vehicle.id),
              content_name: "Favoritos",
            });
          }}
        >
          <FavoritesListWhatsApp vehicles={ordered} />
        </span>
      </div>
    </div>
  );
}

function FavoritesListWhatsApp({ vehicles }: { vehicles: VehicleCardData[] }) {
  const pack = favoritesListWhatsApp(
    vehicles.map((vehicle) => ({
      id: vehicle.id,
      path: vehiclePath(vehicle),
      label: formatVehicleLabel(vehicle.brand, vehicle.model, vehicle.yearModel),
    })),
  );
  return (
    <WhatsAppButton
      className="mt-5 w-full sm:w-auto"
      size="lg"
      trackingLabel="favoritos-lista"
      campaign={pack.campaign}
      content={pack.content}
      vehicleId={pack.vehicleId}
      slug={pack.slug}
      message={pack.message}
    >
      Enviar minha lista no WhatsApp
    </WhatsAppButton>
  );
}
