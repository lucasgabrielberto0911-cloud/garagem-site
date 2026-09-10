export const INSTALL_DISMISS_KEY = "garagem:instalar-dispensado";
export const IOS_TIP_DISMISS_KEY = "garagem:ios-atalho-dispensado";

export type InstallCoachKind = "android" | "ios" | null;

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
