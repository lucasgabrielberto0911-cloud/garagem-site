"use client";

import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { SiteLeadHit } from "@/components/site/VehiclePixel";
import { IconWhatsApp } from "@/components/site/icons";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { queueWhatsAppIfOffline } from "@/lib/offline-whatsapp";
import { WHATSAPP_MESSAGES, whatsappUrl } from "@/lib/site";
import {
  WANTED_BUDGET_OPTIONS,
  wantedBudgetToQuery,
  wantedVehicleHref,
} from "@/lib/wanted-vehicle-page";

/**
 * "Avisar quando chegar": formulário curto. O link abre o WhatsApp com o
 * modelo já preenchido (com origem consentida e fila offline) ou encaminha
 * para `/pedido` com modelo e faixa preenchidos.
 */
export function WantedVehicleCta({
  title = "Avisar quando chegar",
  description = "Diga o modelo. A gente avisa no WhatsApp quando ele entrar no estoque.",
  initialWanted = "",
}: {
  title?: string;
  description?: string;
  initialWanted?: string;
}) {
  const [wanted, setWanted] = useState(initialWanted);
  const [budget, setBudget] = useState<string>("");
  const linkRef = useRef<HTMLAnchorElement>(null);

  const model = wanted.trim();
  const detail = budget
    ? `${model || "(modelo que procuro)"}. Faixa de preço: ${budget}`
    : model;
  const searchString = [model, budget].filter(Boolean).join(" · ");
  const href = whatsappUrl(WHATSAPP_MESSAGES.wanted(detail || undefined), {
    campaign: "estoque",
  });
  const pedidoHref = wantedVehicleHref({
    q: model || undefined,
    ...wantedBudgetToQuery(budget),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    linkRef.current?.click();
  }

  return (
    <div className="mx-auto max-w-3xl border border-brand/40 bg-ink p-5 text-center sm:p-7">
      <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-light">
        Lista de espera
      </p>
      <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
        {description}
      </p>

      <form className="mt-5 grid gap-3 text-left sm:grid-cols-[1fr_auto]" onSubmit={onSubmit}>
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
            {WANTED_BUDGET_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col items-center justify-center gap-2 sm:col-span-2 sm:flex-row">
          <SiteLeadHit
            contentName="Avise-me"
            searchString={searchString || undefined}
          >
            <a
              ref={linkRef}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                trackWhatsAppClick("avise-me");
                if (typeof navigator !== "undefined" && !navigator.onLine) {
                  event.preventDefault();
                  void queueWhatsAppIfOffline({
                    url: event.currentTarget.href || href,
                    label: "avise-me",
                  });
                }
              }}
              className="whatsapp-btn inline-flex min-h-[52px] w-full items-center justify-center gap-2 px-6 font-display text-xs font-semibold uppercase tracking-wide text-white touch-manipulation sm:w-auto"
            >
              <IconWhatsApp className="h-4 w-4" />
              Falar no WhatsApp
            </a>
          </SiteLeadHit>
          <Link
            href={pedidoHref}
            prefetch={false}
            className="inline-flex min-h-[52px] w-full items-center justify-center border border-white/20 px-5 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-white/5 touch-manipulation sm:w-auto"
          >
            Registrar pedido no site
          </Link>
        </div>
      </form>
    </div>
  );
}
