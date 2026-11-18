"use client";

import { IconChat } from "@/components/site/icons";
import { requestSiteChat } from "@/lib/chat-open";
import { trackChatEvent } from "@/lib/meta-pixel";

/**
 * Botão do assistente no topo da home: vermelho cheio, texto branco grande, ícone, cantos
 * arredondados e a mesma altura (mín. 56px) dos outros dois botões grandes. Abre o assistente
 * como antes; o chat continua preguiçoso (DeferredSiteChat) e só baixa no clique.
 */
export function HomeAssistantButton() {
  return (
    <button
      type="button"
      onClick={() => {
        trackChatEvent("ChatHomeCtaClick", { source: "home-hero-cta" });
        requestSiteChat({ source: "home-hero-cta" });
      }}
      data-home-assistant-button=""
      className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-xl border-2 border-brand bg-brand px-6 py-3.5 text-center font-display text-lg font-semibold leading-tight text-white no-underline shadow-md shadow-brand/25 transition hover:border-brand-dark hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt active:bg-brand-dark touch-manipulation"
    >
      <IconChat className="h-6 w-6 shrink-0" />
      Pergunte ao assistente
    </button>
  );
}
