"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { IconClose } from "@/components/site/icons";
import { site } from "@/lib/site";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "garagem:instalar-dispensado";

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    function onPrompt(nativeEvent: Event) {
      nativeEvent.preventDefault();
      setEvent(nativeEvent as InstallEvent);
      window.setTimeout(() => setVisible(true), 2500);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setVisible(false);
    window.localStorage.setItem(DISMISS_KEY, "1");
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      window.localStorage.setItem(DISMISS_KEY, "1");
    }
    setVisible(false);
  }

  if (!visible || !event) return null;

  return (
    <div className="fixed inset-x-3 bottom-[84px] z-[60] border border-white/15 bg-ink/95 p-4 shadow-2xl backdrop-blur animate-slide-up lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[380px]">
      <div className="flex items-start gap-3">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 border border-white/10"
        />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-semibold text-cream">
            Instalar o app da {site.name}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Acesse o estoque e seus favoritos direto da tela inicial, sem abrir o
            navegador.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dispensar"
          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-muted transition hover:text-cream"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[44px] border border-white/15 px-4 font-display text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-cream"
        >
          Agora não
        </button>
        <button
          type="button"
          onClick={install}
          className="min-h-[44px] bg-brand px-4 font-display text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-[#c91418]"
        >
          Instalar
        </button>
      </div>
    </div>
  );
}
