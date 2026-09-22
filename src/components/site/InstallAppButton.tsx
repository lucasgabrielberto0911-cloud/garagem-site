"use client";

import { useEffect, useState } from "react";
import { IconDownload } from "@/components/site/icons";
import { trackPwaEvent } from "@/lib/meta-pixel";
import {
  isIosSafariUserAgent,
  isStandaloneDisplay,
  readInstallPrompt,
  runInstallPrompt,
  shouldOfferInstallControl,
  type InstallCoachKind,
} from "@/lib/pwa-install";

function standaloneNow() {
  return isStandaloneDisplay(
    window.matchMedia("(display-mode: standalone)").matches,
    Boolean(
      "standalone" in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone,
    ),
  );
}

function useInstallOffer(): InstallCoachKind {
  const [kind, setKind] = useState<InstallCoachKind>(null);

  useEffect(() => {
    function sync() {
      const standalone = standaloneNow();
      const iosSafari = isIosSafariUserAgent(
        window.navigator.userAgent,
        window.navigator.maxTouchPoints ?? 0,
      );
      const canPrompt = Boolean(readInstallPrompt());
      if (!shouldOfferInstallControl({ standalone, canPrompt, iosSafari })) {
        setKind(null);
        return;
      }
      setKind(canPrompt ? "android" : "ios");
    }

    sync();
    window.addEventListener("garagem:install-change", sync);
    const media = window.matchMedia("(display-mode: standalone)");
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", sync);
    } else {
      media.addListener(sync);
    }
    return () => {
      window.removeEventListener("garagem:install-change", sync);
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", sync);
      } else {
        media.removeListener(sync);
      }
    };
  }, []);

  return kind;
}

async function installFromControl() {
  const outcome = await runInstallPrompt();
  if (outcome === "accepted") trackPwaEvent("PwaInstallAccepted", { kind: "control" });
  if (outcome === "dismissed") trackPwaEvent("PwaInstallDismissed", { kind: "control" });
  return outcome;
}

/** Desktop: só aparece quando o Chrome oferece instalação. Sem banner. */
export function InstallAppHeaderButton() {
  const kind = useInstallOffer();
  if (kind !== "android") return null;

  return (
    <button
      type="button"
      onClick={() => void installFromControl()}
      className="hidden h-11 items-center gap-2 whitespace-nowrap border border-white/15 px-3 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:border-brand lg:inline-flex"
    >
      <IconDownload className="h-4 w-4" />
      Instalar app
    </button>
  );
}

/** Menu mobile: Android instala na hora; iOS mostra o passo do Safari. */
export function InstallAppMenuItem({ onClose }: { onClose: () => void }) {
  const kind = useInstallOffer();
  const [help, setHelp] = useState(false);
  if (!kind) return null;

  if (kind === "ios") {
    return (
      <div className="mt-4 border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={() => {
            if (!help) trackPwaEvent("PwaIosTipShown", { kind: "menu" });
            setHelp(true);
          }}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 border border-white/15 px-4 font-display text-base font-semibold text-cream touch-manipulation"
        >
          <IconDownload className="h-5 w-5" />
          Adicionar à Tela de Início
        </button>
        {help ? (
          <p className="mt-3 text-center text-sm leading-relaxed text-muted">
            No Safari, toque em Compartilhar e depois em Adicionar à Tela de
            Início. O atalho abre o estoque como um app.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <button
        type="button"
        onClick={() => {
          void installFromControl().then(() => onClose());
        }}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 border border-white/15 px-4 font-display text-base font-semibold text-cream touch-manipulation"
      >
        <IconDownload className="h-5 w-5" />
        Instalar app
      </button>
    </div>
  );
}
