"use client";

import { ChatOpenButton } from "@/components/site/ChatOpenButton";
import { WhatsAppButton } from "@/components/site/ui";
import { SiteLeadHit } from "@/lib/funnel-events";
import type { StockEmptyWhatsAppCta } from "@/lib/stock-waitlist";

export function StockEmptyState({
  error,
  emptyWhatsApp,
}: {
  error: string;
  emptyWhatsApp: StockEmptyWhatsAppCta;
}) {
  return (
    <div data-stock-empty="" className="mx-auto max-w-2xl rounded-xl border border-white/20 bg-ink px-4 py-6 text-center sm:px-6 sm:py-10">
      <p className="font-display text-lg font-semibold text-cream [overflow-wrap:anywhere]">
        {error ? "Não foi possível carregar o estoque" : "Estoque sendo montado"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-cream/80">
        {error
          ? "Tente novamente em alguns instantes. Se preferir, fale conosco no WhatsApp."
          : "Estamos selecionando os próximos veículos. Diga o que você procura que buscamos para você."}
      </p>
      <div className="mt-5 flex flex-col items-center gap-3">
        <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          <SiteLeadHit contentName="Avise-me">
            <WhatsAppButton
              trackingLabel={emptyWhatsApp.trackingLabel}
              campaign={emptyWhatsApp.campaign}
              message={emptyWhatsApp.message}
              variant="solid"
            >
              {emptyWhatsApp.label}
            </WhatsAppButton>
          </SiteLeadHit>
          {!error ? (
            <ChatOpenButton
              source="estoque-vazio"
              prompt="Quero ajuda para escolher um veículo"
              variant="outline"
            />
          ) : null}
        </div>
        <p className="max-w-md text-xs leading-relaxed text-cream/80">
          Abre o WhatsApp para você dizer o que procura.
        </p>
      </div>
    </div>
  );
}
