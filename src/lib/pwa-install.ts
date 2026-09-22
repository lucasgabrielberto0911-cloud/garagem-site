import { isPrecachedShellPath, normalizePathname } from "@/lib/pwa-page-key";

export const INSTALL_DISMISS_KEY = "garagem:instalar-dispensado";
export const IOS_TIP_DISMISS_KEY = "garagem:ios-atalho-dispensado";
export const INSTALL_SEEN_AT_KEY = "garagem:instalar-visto-em";
/** Banner automático no máximo uma vez a cada 14 dias. O botão do menu continua. */
export const INSTALL_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
/** Abertura do app instalado. O SW ignora utm na chave de cache. */
export const PWA_START_URL = "/?utm_source=pwa&utm_medium=homescreen";

export type InstallCoachKind = "android" | "ios" | null;

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallBag = { prompt: BeforeInstallPromptEvent | null };

const INSTALL_CHANGE_EVENT = "garagem:install-change";

export function isStandaloneDisplay(
  mediaMatches?: boolean,
  iosStandalone?: boolean,
) {
  return Boolean(mediaMatches || iosStandalone);
}

export function isIosSafariUserAgent(userAgent: string, maxTouchPoints = 0) {
  const ua = userAgent.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(ua);
  const ipadOs = /macintosh/.test(ua) && maxTouchPoints > 1;
  if (!ios && !ipadOs) return false;
  if (/crios|fxios|edgios|opios/.test(ua)) return false;
  return true;
}

export function shouldShowInstallCoach(input: {
  dismissed: boolean;
  standalone: boolean;
  hideOnMoneyPage: boolean;
}) {
  return !input.dismissed && !input.standalone && !input.hideOnMoneyPage;
}

export function isMoneyPagePath(pathname: string | null | undefined) {
  const path = pathname ?? "";
  return path === "/estoque" || path.startsWith("/estoque/");
}

export function shouldAutoShowInstallCoach(input: {
  dismissed: boolean;
  standalone: boolean;
  hideOnMoneyPage: boolean;
  mobileSurface: boolean;
  seenAt: number | null;
  now: number;
}) {
  if (!input.mobileSurface) return false;
  if (
    !shouldShowInstallCoach({
      dismissed: input.dismissed,
      standalone: input.standalone,
      hideOnMoneyPage: input.hideOnMoneyPage,
    })
  ) {
    return false;
  }
  if (input.seenAt == null || Number.isNaN(input.seenAt)) return true;
  return input.now - input.seenAt >= INSTALL_COOLDOWN_MS;
}

/** Botão explícito. Independente do banner: dispensar o banner não esconde o controle. */
export function shouldOfferInstallControl(input: {
  standalone: boolean;
  canPrompt: boolean;
  iosSafari: boolean;
}) {
  if (input.standalone) return false;
  return input.canPrompt || input.iosSafari;
}

/**
 * No offline (ou rede muito lenta) a navegação do Next é RSC e não usa o HTML
 * em cache. Forçamos um carregamento completo para o service worker responder.
 * Em Wi-Fi/4G o clique continua client-side — o desktop não muda.
 */
export function shouldForceDocumentNavigation(input: {
  online: boolean;
  saveData?: boolean;
  effectiveType?: string;
  pathname: string;
}) {
  const path = normalizePathname(input.pathname);
  if (
    path.startsWith("/admin") ||
    path.startsWith("/api") ||
    path.startsWith("/_next")
  ) {
    return false;
  }
  if (!input.online) return true;
  const flaky =
    Boolean(input.saveData) ||
    input.effectiveType === "2g" ||
    input.effectiveType === "slow-2g";
  if (!flaky) return false;
  return isPrecachedShellPath(path);
}

function installBag(): InstallBag | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { __garagemInstall?: InstallBag };
  if (!host.__garagemInstall) host.__garagemInstall = { prompt: null };
  return host.__garagemInstall;
}

export function readInstallPrompt() {
  return installBag()?.prompt ?? null;
}

export function clearInstallPrompt() {
  const bag = installBag();
  if (bag) bag.prompt = null;
}

export function notifyInstallChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(INSTALL_CHANGE_EVENT));
}

export async function runInstallPrompt(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  const event = readInstallPrompt();
  if (!event) return "unavailable";
  try {
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      try {
        window.localStorage.setItem(INSTALL_DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    return choice.outcome;
  } finally {
    clearInstallPrompt();
    notifyInstallChange();
  }
}

/** Script no <head>: o `beforeinstallprompt` dispara antes do React hidratar. */
export function installCaptureScript() {
  return `(function(){
    if (window.__garagemInstallBound) return;
    window.__garagemInstallBound = 1;
    window.__garagemInstall = window.__garagemInstall || { prompt: null };
    window.addEventListener("beforeinstallprompt", function(event) {
      event.preventDefault();
      window.__garagemInstall.prompt = event;
      window.dispatchEvent(new Event(${JSON.stringify(INSTALL_CHANGE_EVENT)}));
    });
    window.addEventListener("appinstalled", function() {
      window.__garagemInstall.prompt = null;
      try { localStorage.setItem(${JSON.stringify(INSTALL_DISMISS_KEY)}, "1"); } catch (e) {}
      window.dispatchEvent(new Event(${JSON.stringify(INSTALL_CHANGE_EVENT)}));
    });
  })();`;
}
