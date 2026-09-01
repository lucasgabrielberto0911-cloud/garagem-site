"use client";

import { useState } from "react";
import { SiteLeadHit } from "@/components/site/VehiclePixel";
import { IconWhatsApp } from "@/components/site/icons";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";

const BUDGETS = [
  "Até R$ 50 mil",
  "R$ 50 a 80 mil",
  "R$ 80 a 120 mil",
  "Acima de R$ 120 mil",
] as const;

/**
 * "Avise quando chegar": em vez de guardar um alerta que ninguém acompanha,
 * o pedido vai direto para o WhatsApp já formatado, onde a loja realmente
 * responde.
 */
export function WantedVehicleCta({
  title = "Não achou o que procura?",
  description = "Diga o que você quer que a gente avisa assim que entrar no estoque — geralmente antes de anunciar.",
  initialWanted = "",
}: {
  title?: string;
  description?: string;
  initialWanted?: string;
}) {
  const [wanted, setWanted] = useState(initialWanted);
  const [budget, setBudget] = useState<string>("");

  const model = wanted.trim() || "(modelo que procuro)";
  const detail = budget ? `${model}. Faixa de preço: ${budget}` : model;
  const searchString = [wanted.trim(), budget].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-3xl border border-white/10 bg-ink p-6 text-center sm:p-8">
      <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
        {title}
      </h2>
      <div
        className="mx-auto mt-3 h-0.5 w-12 bg-brand-gradient"
        aria-hidden="true"
      />
      <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted">
        {description}
      </p>

      <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
        <label className="block">
          <span className="sr-only">Modelo que você procura</span>
          <input
            type="text"
            value={wanted}
            onChange={(event) => setWanted(event.target.value)}
            placeholder="Ex.: Corolla XEi 2020 automático"
            className="w-full min-h-[48px] border border-white/10 bg-asphalt px-3 text-base text-cream outline-none transition placeholder:text-muted focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="sr-only">Faixa de preço</span>
          <select
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            className="w-full min-h-[48px] border border-white/10 bg-asphalt px-3 text-base text-cream outline-none transition focus:border-brand"
          >
            <option value="">Faixa de preço</option>
            {BUDGETS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <SiteLeadHit
        contentName="Avise-me"
        searchString={searchString || undefined}
      >
        <a
          href={whatsappUrl(WHATSAPP_MESSAGES.wanted(detail))}
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-btn mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 px-6 font-display text-xs font-semibold uppercase tracking-wide text-white touch-manipulation sm:w-auto sm:text-sm"
        >
          <IconWhatsApp className="h-4 w-4" />
          Quero ser avisado
        </a>
      </SiteLeadHit>
    </div>
  );
}
