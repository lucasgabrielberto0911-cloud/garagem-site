"use client";

import { useState } from "react";
import {
  FINANCE_DISCLAIMER,
  FINANCE_INSTALLMENT_OPTIONS,
  financeWhatsAppMessage,
  simulateFinance,
} from "@/lib/finance-simulation";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { fichaWhatsAppTracking, whatsappUrl } from "@/lib/site";
import { trackEvent } from "@/lib/track-event";

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Simulação indicativa na ficha: entrada, parcelas e envio dos valores pelo WhatsApp. */
export function FinanceSimulator({
  vehicleId,
  slug,
  path,
  label,
  price,
  isMoto = false,
}: {
  vehicleId: string;
  slug?: string;
  path?: string;
  label: string;
  price: number;
  isMoto?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [downPct, setDownPct] = useState(30);
  const [months, setMonths] = useState<number>(48);

  const down = Math.round((price * downPct) / 100);
  const simulation = simulateFinance({ price, down, months });
  if (!simulation) return null;

  const href = whatsappUrl(
    financeWhatsAppMessage({ label, price, simulation, isMoto }),
    fichaWhatsAppTracking({ id: vehicleId, path }),
  );
  const track = (action: string) =>
    trackEvent("finance_simulate", { action, down_pct: downPct, months }, { vehicleId, slug });

  return (
    <div className="border border-white/10 bg-asphalt/50">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          if (!open) track("open");
          setOpen((v) => !v);
        }}
        className="flex min-h-[48px] w-full items-center justify-between px-3 text-left font-display text-sm font-semibold uppercase tracking-wide text-cream"
      >
        Simular financiamento
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <div className="space-y-3 px-3 pb-3">
          <label className="block text-xs text-cream/80">
            Entrada: {brl(down)} ({downPct}%)
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={downPct}
              onChange={(e) => setDownPct(Number(e.target.value))}
              onPointerUp={() => track("adjust")}
              className="mt-1 w-full accent-[#E8181C]"
            />
          </label>
          <label className="block text-xs text-cream/80">
            Parcelas
            <select
              value={months}
              onChange={(e) => {
                setMonths(Number(e.target.value));
                track("adjust");
              }}
              className="mt-1 w-full border border-white/10 bg-ink px-2 py-2 text-sm text-cream"
            >
              {FINANCE_INSTALLMENT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          </label>
          <p className="font-display text-xl font-bold text-cream">
            {simulation.installment > 0
              ? `${months}x de cerca de ${brl(simulation.installment)}`
              : "Sem parcelas: entrada cobre o valor"}
          </p>
          <p className="text-[11px] leading-relaxed text-muted">{FINANCE_DISCLAIMER}</p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              track("whatsapp");
              trackWhatsAppClick("ficha-finance-sim", { vehicleId, slug });
            }}
            className="inline-flex min-h-[48px] w-full items-center justify-center bg-brand px-5 font-display text-sm font-semibold uppercase tracking-wide text-asphalt transition hover:bg-brand-orange"
          >
            Enviar simulação no WhatsApp
          </a>
        </div>
      ) : null}
    </div>
  );
}
