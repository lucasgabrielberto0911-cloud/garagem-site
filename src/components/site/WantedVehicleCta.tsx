"use client";

import { type FormEvent, useState } from "react";
import { SiteLeadHit } from "@/components/site/VehiclePixel";
import { IconWhatsApp } from "@/components/site/icons";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

const BUDGETS = [
  "Até R$ 50 mil",
  "R$ 50 a 80 mil",
  "R$ 80 a 120 mil",
  "Acima de R$ 120 mil",
] as const;

/**
 * "Avisar quando chegar": formulário curto. O pedido abre o WhatsApp
 * com o modelo já preenchido — não há fila local para acompanhar.
 */
export function WantedVehicleCta({
  title = "Avisar quando chegar",
  description = "Diz o modelo. A gente avisa no WhatsApp quando entrar no estoque.",
  initialWanted = "",
}: {
  title?: string;
  description?: string;
  initialWanted?: string;
}) {
  const [wanted, setWanted] = useState(initialWanted);
  const [budget, setBudget] = useState<string>("");

  const model = wanted.trim();
  const detail = budget
    ? `${model || "(modelo que procuro)"}. Faixa de preço: ${budget}`
    : model;
  const searchString = [model, budget].filter(Boolean).join(" · ");
  const href = whatsappUrl(WHATSAPP_MESSAGES.wanted(detail || undefined), {
    campaign: "estoque",
  });

  function openWhatsApp(event?: FormEvent) {
    event?.preventDefault();
    trackWhatsAppClick("avise-me");
    window.open(href, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-3xl border border-brand/40 bg-ink p-5 text-center sm:p-7">
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
        Lista de espera
      </p>
      <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
        {description}
      </p>

      <form className="mt-5 grid gap-3 text-left sm:grid-cols-[1fr_auto]" onSubmit={openWhatsApp}>
        <label className="block sm:col-span-1">
          <span className="sr-only">Modelo que você procura</span>
          <input
            type="text"
            value={wanted}
            onChange={(event) => setWanted(event.target.value)}
            placeholder="Ex.: Corolla automático 2020"
            autoComplete="off"
            className="w-full min-h-[48px] border border-white/10 bg-asphalt px-3 text-base text-cream outline-none transition placeholder:text-muted focus:border-brand"
          />
        </label>
        <label className="block sm:col-span-1 sm:w-44">
          <span className="sr-only">Faixa de preço</span>
          <select
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            className="w-full min-h-[48px] border border-white/10 bg-asphalt px-3 text-base text-cream outline-none transition focus:border-brand"
          >
            <option value="">Faixa (opcional)</option>
            {BUDGETS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <SiteLeadHit
          contentName="Avise-me"
          searchString={searchString || undefined}
        >
          <button
            type="submit"
            className="whatsapp-btn inline-flex min-h-[52px] w-full items-center justify-center gap-2 px-6 font-display text-xs font-semibold uppercase tracking-wide text-white touch-manipulation sm:col-span-2 sm:w-auto sm:justify-self-center"
          >
            <IconWhatsApp className="h-4 w-4" />
            Avisar no WhatsApp
          </button>
        </SiteLeadHit>
      </form>
    </div>
  );
}
