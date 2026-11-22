"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  setVehicleFeatured,
  setVehiclePrice,
} from "@/app/admin/veiculos/actions";
import {
  IconCash,
  IconClock,
  IconExternal,
  IconImage,
  IconPencil,
  IconStar,
} from "@/components/admin/icons";
import { Badge, EmptyState, btn, inputClass } from "@/components/admin/ui";
import { adminDate } from "@/lib/admin-date";
import { moneyInput } from "@/lib/admin-money";
import {
  PARKED_MIN_DAYS,
  formatFipeComparison,
  parkedFunnelReading,
  type ParkedVehicleItem,
} from "@/lib/admin-parados";
import { quickPriceError } from "@/lib/admin-quick-price";
import {
  groupParkedByAgeBand,
  stockAgeBandBadgeClass,
} from "@/lib/admin-stock-age";
import { canEnableFeatured, featuredCapMessage } from "@/lib/featured";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";

export function ParkedVehiclesList({
  items,
  viewsAvailable = true,
  featuredCount: featuredCountProp,
}: {
  items: ParkedVehicleItem[];
  viewsAvailable?: boolean;
  featuredCount?: number;
}) {
  const [priceById, setPriceById] = useState<Record<string, number>>({});
  const [featuredById, setFeaturedById] = useState<Record<string, boolean>>({});
  const [currentFeaturedCount, setCurrentFeaturedCount] = useState(
    () =>
      featuredCountProp ??
      items.filter((item) => item.featured).length,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<string | null>(
    null,
  );

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<IconClock className="h-9 w-9" />}
        title={`Nenhum carro parado há mais de ${PARKED_MIN_DAYS} dias`}
        description="O estoque está girando bem — todos os veículos disponíveis entraram nos últimos 30 dias."
        action={
          <Link href="/admin/veiculos?status=disponivel" className={btn.outline}>
            Ver estoque disponível
          </Link>
        }
      />
    );
  }

  const groups = groupParkedByAgeBand(items).filter(
    (group) => group.items.length > 0,
  );

  function openPriceEditor(item: ParkedVehicleItem) {
    const currentPrice = priceById[item.id] ?? item.price;
    if (editingId === item.id) {
      setEditingId(null);
      setPriceError(null);
      return;
    }
    setEditingId(item.id);
    setPriceDraft(currentPrice > 0 ? moneyInput(currentPrice) : "");
    setPriceError(null);
  }

  async function savePrice(item: ParkedVehicleItem) {
    const validation = quickPriceError({
      raw: priceDraft,
      status: "disponivel",
    });
    if (validation) {
      setPriceError(validation);
      return;
    }
    setSavingId(item.id);
    setPriceError(null);
    try {
      const result = await setVehiclePrice(item.id, priceDraft);
      if (result.ok) {
        setPriceById((current) => ({ ...current, [item.id]: result.price }));
        setEditingId(null);
        toast.success(result.message);
      } else {
        setPriceError(result.message);
      }
    } catch {
      setPriceError("Não foi possível salvar o preço agora. Tente novamente.");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleFeatured(item: ParkedVehicleItem) {
    const currentlyFeatured = featuredById[item.id] ?? item.featured;
    const nextFeatured = !currentlyFeatured;
    if (
      nextFeatured &&
      !canEnableFeatured(currentFeaturedCount, currentlyFeatured)
    ) {
      toast.error(featuredCapMessage());
      return;
    }

    setTogglingFeaturedId(item.id);
    try {
      const result = await setVehicleFeatured(item.id, nextFeatured);
      if (result.ok) {
        setFeaturedById((current) => ({ ...current, [item.id]: nextFeatured }));
        setCurrentFeaturedCount((count) =>
          Math.max(0, count + (nextFeatured ? 1 : -1)),
        );
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("Não foi possível atualizar o destaque agora. Tente novamente.");
    } finally {
      setTogglingFeaturedId(null);
    }
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const isUrgent = group.id === "60+";
        return (
          <section
            key={group.id}
            id={`faixa-${group.id}`}
            aria-labelledby={`faixa-titulo-${group.id}`}
            className="space-y-3 scroll-mt-4"
          >
            <div
              className={`flex flex-col gap-1.5 border-l-4 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between ${
                isUrgent
                  ? "border-brand bg-brand/10"
                  : group.id === "46-60"
                    ? "border-brand/60 bg-ink/70"
                    : "border-white/30 bg-ink/50"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id={`faixa-titulo-${group.id}`}
                  className="font-display text-base font-bold uppercase tracking-wide text-cream"
                >
                  {group.label}
                </h2>
                <Badge tone={isUrgent ? "brand" : "neutral"}>
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "carro" : "carros"}
                </Badge>
              </div>
              <p className="text-sm font-medium text-cream/90">
                Ação sugerida: {group.suggestion}
              </p>
            </div>

            <ul className="space-y-2.5">
              {group.items.map((item) => {
                const currentPrice = priceById[item.id] ?? item.price;
                const isFeatured = featuredById[item.id] ?? item.featured;
                const fipe = formatFipeComparison(currentPrice, item.fipePrice);
                const enteredDate = new Date(item.enteredAt);
                const enteredLabel = Number.isNaN(enteredDate.getTime())
                  ? "—"
                  : adminDate(enteredDate);
                const visits30dLabel = viewsAvailable
                  ? formatNumberBR(item.views)
                  : "—";
                const visits7dLabel = viewsAvailable
                  ? formatNumberBR(item.views7d)
                  : "—";
                const whatsappLabel = viewsAvailable
                  ? formatNumberBR(item.whatsappClicks)
                  : "—";
                const reading = parkedFunnelReading({
                  views30d: item.views,
                  whatsappClicks: item.whatsappClicks,
                  viewsAvailable,
                });
                const encodedId = encodeURIComponent(item.id);
                const editHref = `/admin/veiculos/${encodedId}`;
                const photosHref = `/admin/veiculos/${encodedId}?view=fotos`;
                const isEditing = editingId === item.id;
                const isSaving = savingId === item.id;
                const isTogglingFeatured = togglingFeaturedId === item.id;

                return (
                  <li
                    key={item.id}
                    className={`border bg-ink/50 transition ${
                      isUrgent ? "border-brand/35" : "border-white/15"
                    }`}
                  >
                    <div className="flex flex-col gap-3 p-3.5 sm:p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 font-display text-xs font-semibold tabular-nums ${stockAgeBandBadgeClass(group.id)}`}
                          >
                            {item.daysParked} dias
                          </span>
                          <span className="text-xs text-cream/75">
                            Desde {enteredLabel}
                          </span>
                          {isFeatured ? (
                            <span className="inline-flex items-center bg-brand/20 px-2 py-0.5 font-display text-[11px] font-semibold uppercase tracking-wide text-red-200 ring-1 ring-inset ring-brand/45">
                              Na home
                            </span>
                          ) : null}
                        </div>

                        <p className="font-display text-base font-semibold leading-snug text-cream break-words">
                          {item.name}
                        </p>

                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-display text-lg font-bold tabular-nums text-cream">
                            {currentPrice > 0
                              ? formatCurrencyBRL(currentPrice)
                              : "Sem preço"}
                          </span>
                          {fipe ? (
                            <span
                              className={`text-xs font-medium tabular-nums ${
                                fipe.tone === "brand"
                                  ? "text-red-300"
                                  : fipe.tone === "success"
                                    ? "text-emerald-300"
                                    : "text-cream/80"
                              }`}
                            >
                              FIPE {fipe.fipeFormatted} ({fipe.deltaLabel})
                            </span>
                          ) : null}
                        </div>

                        {reading ? (
                          <p
                            className={`inline-block border px-2.5 py-1 text-xs font-medium leading-snug ${
                              reading.tone === "brand"
                                ? "border-brand/45 bg-brand/15 text-red-200"
                                : "border-white/15 bg-white/5 text-cream/85"
                            }`}
                          >
                            {reading.label}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 sm:flex sm:items-stretch sm:gap-3 lg:border-t-0 lg:pt-0">
                        <div className="border border-white/10 bg-asphalt/50 px-3 py-2 sm:min-w-[126px]">
                          <p className="text-[11px] uppercase tracking-wider text-cream/70">
                            Visitas (30d)
                          </p>
                          <p className="mt-0.5 font-display text-base font-bold tabular-nums text-cream">
                            {visits30dLabel}
                          </p>
                          <p className="text-[11px] tabular-nums text-cream/70">
                            {visits7dLabel} nos últimos 7d
                          </p>
                        </div>
                        <div className="border border-white/10 bg-asphalt/50 px-3 py-2 sm:min-w-[136px]">
                          <p className="text-[11px] uppercase tracking-wider text-cream/70">
                            Cliques WhatsApp (30d)
                          </p>
                          <p className="mt-0.5 font-display text-base font-bold tabular-nums text-cream">
                            {whatsappLabel}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-asphalt/30 px-3.5 py-2.5 sm:px-4">
                      <button
                        type="button"
                        onClick={() => openPriceEditor(item)}
                        aria-expanded={isEditing}
                        disabled={isSaving}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 border border-white/20 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60"
                      >
                        <IconCash className="h-4 w-4" />
                        Alterar preço
                      </button>

                      <Link
                        href={photosHref}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 border border-white/20 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-cream transition touch-manipulation hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <IconImage className="h-4 w-4" />
                        Trocar capa
                      </Link>

                      <button
                        type="button"
                        onClick={() => void toggleFeatured(item)}
                        aria-pressed={isFeatured}
                        disabled={isTogglingFeatured}
                        className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 border px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60 ${
                          isFeatured
                            ? "border-brand/60 bg-brand/15 text-red-200 hover:border-brand"
                            : "border-white/20 text-cream hover:border-brand"
                        }`}
                      >
                        <IconStar className="h-4 w-4" filled={isFeatured} />
                        {isFeatured ? "Fixado na home" : "Fixar na home"}
                      </button>

                      <Link
                        href={editHref}
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 border border-white/15 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-cream/90 transition touch-manipulation hover:border-white/35 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <IconPencil className="h-4 w-4" />
                        Abrir ficha do carro
                      </Link>

                      <Link
                        href={item.publicPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 border border-white/15 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wide text-cream/85 transition touch-manipulation hover:border-white/35 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <IconExternal className="h-4 w-4" />
                        Ver no site
                      </Link>
                    </div>

                    {isEditing ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void savePrice(item);
                        }}
                        className="border-t border-white/15 bg-asphalt/60 p-3.5 sm:px-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <div className="min-w-0 flex-1">
                            <label
                              htmlFor={`parado-preco-${item.id}`}
                              className="block text-xs font-semibold text-cream/85"
                            >
                              Preço à vista (R$)
                            </label>
                            <input
                              id={`parado-preco-${item.id}`}
                              type="text"
                              inputMode="decimal"
                              autoFocus
                              value={priceDraft}
                              onChange={(event) => {
                                setPriceDraft(event.target.value);
                                if (priceError) setPriceError(null);
                              }}
                              placeholder="Ex.: 45.900,00"
                              aria-invalid={Boolean(priceError)}
                              className={`mt-1 ${inputClass}`}
                            />
                            {priceError ? (
                              <p
                                role="alert"
                                className="mt-1.5 text-xs text-red-300"
                              >
                                {priceError}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              disabled={isSaving}
                              className={btn.primary}
                            >
                              {isSaving ? "Salvando…" : "Salvar preço"}
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                setEditingId(null);
                                setPriceError(null);
                              }}
                              className={btn.outline}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p className="text-xs leading-relaxed text-cream/75">
        Agrupado por faixa de dias em estoque (do mais urgente ao menos urgente).
        Visitas (7 e 30 dias) e cliques no WhatsApp (30 dias) consideram acessos
        registrados no site com consentimento de medição.
      </p>
    </div>
  );
}
