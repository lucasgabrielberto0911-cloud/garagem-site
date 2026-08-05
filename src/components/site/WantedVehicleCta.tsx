"use client";

import { useState } from "react";
import { IconWhatsApp } from "@/components/site/icons";
import { whatsappUrl } from "@/lib/site";

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
}: {
  title?: string;
  description?: string;
}) {
  const [wanted, setWanted] = useState("");
  const [budget, setBudget] = useState<string>("");

  const message = `Olá! Quero ser avisado quando chegar: ${
    wanted.trim() || "(modelo que procuro)"
  }${budget ? `. Faixa de preço: ${budget}` : ""}.`;

  return (
    <div className="border border-white/10 bg-ink p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
        {title}
      </h2>
      <div className="mt-3 h-0.5 w-12 bg-brand-gradient" aria-hidden="true" />
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
        {description}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
        <label className="block">
          <span className="sr-only">Modelo que você procura</span>
          <input
            type="text"
            value={wanted}
            onChange={(event) => setWanted(event.target.value)}
            placeholder="Ex.: Corolla XEi 2020 automático"
            className="w-full min-h-[48px] border border-white/10 bg-asphalt px-3 text-sm text-cream outline-none transition placeholder:text-muted focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="sr-only">Faixa de preço</span>
          <select
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            className="w-full min-h-[48px] border border-white/10 bg-asphalt px-3 text-sm text-cream outline-none transition focus:border-brand"
          >
            <option value="">Faixa de preço</option>
            {BUDGETS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <a
          href={whatsappUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className="whatsapp-btn inline-flex min-h-[48px] items-center justify-center gap-2 px-5 font-display text-xs font-semibold uppercase tracking-wide text-white touch-manipulation sm:text-sm"
        >
          <IconWhatsApp className="h-4 w-4" />
          Quero ser avisado
        </a>
      </div>
    </div>
  );
}
