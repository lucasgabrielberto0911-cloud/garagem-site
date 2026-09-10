"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconClose } from "@/components/site/icons";
import { trackPwaEvent } from "@/lib/meta-pixel";
import {
  INSTALL_DISMISS_KEY,
  IOS_TIP_DISMISS_KEY,
  isIosSafariUserAgent,
  isMoneyPagePath,
  isStandaloneDisplay,
  shouldShowInstallCoach,
  type InstallCoachKind,
} from "@/lib/pwa-install";
import { site } from "@/lib/site";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const pathname = usePathname();
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [kind, setKind] = useState<InstallCoachKind>(null);
  const [visible, setVisible] = useState(false);
  const hideOnMoneyPage = isMoneyPagePath(pathname);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const standalone = isStandaloneDisplay(
      window.matchMedia("(display-mode: standalone)").matches,
      Boolean(
        "standalone" in window.navigator &&
          (window.navigator as Navigator & { standalone?: boolean }).standalone,
      ),
    );
    const ios = isIosSafariUserAgent(
      window.navigator.userAgent,
      window.navigator.maxTouchPoints ?? 0,
    );

    function reveal(next: InstallCoachKind) {
      if (
        !shouldShowInstallCoach({
          dismissed: false,
          standalone,
          hideOnMoneyPage,
        })
      ) {
        return;
      }
      setKind(next);
      setVisible(true);
      trackPwaEvent(next === "ios" ? "PwaIosTipShown" : "PwaInstallPromptShown");
    }

    if (standalone) return;

    function onPrompt(nativeEvent: Event) {
      nativeEvent.preventDefault();
      if (window.localStorage.getItem(INSTALL_DISMISS_KEY) === "1") return;
      setEvent(nativeEvent as InstallEvent);
      window.setTimeout(() => reveal("android"), 12000);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);

    let iosTimer = 0;
    if (ios && window.localStorage.getItem(IOS_TIP_DISMISS_KEY) !== "1") {
      iosTimer = window.setTimeout(() => reveal("ios"), 10000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, [hideOnMoneyPage]);

  function dismiss() {
    setVisible(false);
    if (kind === "ios") {
      window.localStorage.setItem(IOS_TIP_DISMISS_KEY, "1");
      trackPwaEvent("PwaIosTipDismissed");
    } else {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
      trackPwaEvent("PwaInstallDismissed");
    }
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
      trackPwaEvent("PwaInstallAccepted");
    } else {
      trackPwaEvent("PwaInstallDismissed");
    }
    setVisible(false);
  }

  if (!visible || !kind || hideOnMoneyPage) return null;

  return (
    <div
      data-install-coach=""
      className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px)+0.75rem)] z-[35] border border-white/15 bg-ink/95 p-3 shadow-2xl backdrop-blur animate-slide-up pl-safe pr-safe lg:inset-x-auto lg:bottom-6 lg:left-6 lg:right-auto lg:w-[360px] lg:p-4"
      role="dialog"
      aria-label={kind === "ios" ? "Adicionar à Tela de Início" : "Instalar aplicativo"}
    >
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
            {kind === "ios"
              ? `Adicionar ${site.name} à Tela de Início`
              : `Instalar o app da ${site.name}`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {kind === "ios"
              ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início. Não pedimos de novo se você dispensar."
              : "Acesse o estoque e seus favoritos direto da tela inicial, sem abrir o navegador."}
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

      <div className={`mt-4 grid gap-2 ${kind === "ios" ? "grid-cols-1" : "grid-cols-[auto_1fr]"}`}>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[44px] border border-white/15 px-4 font-display text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-cream"
        >
          Agora não
        </button>
        {kind === "android" ? (
          <button
            type="button"
            onClick={() => void install()}
            className="min-h-[44px] bg-brand px-4 font-display text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-[#c91418]"
          >
            Instalar
          </button>
        ) : null}
      </div>
    </div>
  );
}
