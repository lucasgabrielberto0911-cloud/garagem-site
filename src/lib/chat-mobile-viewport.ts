/**
 * Teclado virtual no chat: o visualViewport encolhe; o inset de baixo
 * é a área coberta (iOS/Android). Acima do limiar, o painel cola no
 * viewport visível para o campo não ficar atrás do teclado.
 */
export const CHAT_MOBILE_KEYBOARD_PX = 80;

/** Tokens alinhados a `.site-chat` em globals.css (1rem = 16px). */
export const CHAT_LAYOUT = {
  desktopMinWidthPx: 1024,
  panelMaxPx: 680,
  panelWidthPx: 448,
  fabPx: 56,
  fabGapPx: 12,
  /** Legacy: `h-[min(680px,calc(100dvh-7.25rem))]`. */
  legacyPanelReservePx: 116,
  /** Legacy: FAB empilhado acima do WhatsApp (6.25rem) — meio do conteúdo. */
  legacyClosedDesktopBottomPx: 100,
  /** Legacy: FAB na ficha a 8.5rem — meio do conteúdo / fotos. */
  legacyClosedFichaStickyBottomPx: 136,
  /** FAB fechado no desktop: mesma baseline do float WhatsApp (1.5rem). */
  closedDesktopBottomPx: 24,
  /** `1.5rem + 3.5rem + 0.75rem` — à esquerda do float, não empilhado. */
  closedDesktopRightPx: 92,
  closedDesktopWhatsAppInsetPx: 24,
  closedDesktopFabWidthPx: 220,
  /** FAB fechado no mobile, acima da bottom nav. */
  closedMobileNavBottomPx: 84,
  closedMobileRightPx: 16,
  closedMobileFabWidthPx: 200,
  openDesktopInsetPx: { top: 16, right: 24, bottom: 20 },
  openMobileInsetPx: { top: 8, right: 8, bottom: 8 },
} as const;

export type ChatClosedLauncherContext = {
  desktop: boolean;
  /** Página da ficha (`data-vehicle-mobile-bar`). */
  ficha: boolean;
  /**
   * Home/estoque com faixa de chips (Faixa / Marca). Não esconde o FAB —
   * a faixa inline no meio da listagem foi removida.
   */
  chips: boolean;
  /** Banner de cookies. No mobile some o FAB em vez de subir ao meio. */
  consent?: boolean;
};

type ChatBox = {
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
};

export function chatClosedLauncherVisible(
  ctx: ChatClosedLauncherContext,
): boolean {
  if (ctx.ficha) return false;
  if (!ctx.desktop && ctx.consent) return false;
  return true;
}

export function chatWhatsAppFloatBox(
  viewportWidth: number,
  viewportHeight: number,
): ChatBox {
  const size = CHAT_LAYOUT.fabPx;
  const inset = CHAT_LAYOUT.closedDesktopWhatsAppInsetPx;
  return {
    width: size,
    height: size,
    right: inset,
    bottom: inset,
    top: viewportHeight - inset - size,
    left: viewportWidth - inset - size,
  };
}

export function chatClosedLauncherBox({
  viewportWidth,
  viewportHeight,
  ...ctx
}: ChatClosedLauncherContext & {
  viewportWidth: number;
  viewportHeight: number;
}): ChatBox | null {
  if (!chatClosedLauncherVisible(ctx)) return null;
  const width = ctx.desktop
    ? CHAT_LAYOUT.closedDesktopFabWidthPx
    : CHAT_LAYOUT.closedMobileFabWidthPx;
  const height = CHAT_LAYOUT.fabPx;
  const bottom = ctx.desktop
    ? CHAT_LAYOUT.closedDesktopBottomPx
    : CHAT_LAYOUT.closedMobileNavBottomPx;
  const right = ctx.desktop
    ? CHAT_LAYOUT.closedDesktopRightPx
    : CHAT_LAYOUT.closedMobileRightPx;
  return {
    width,
    height,
    right,
    bottom,
    top: viewportHeight - bottom - height,
    left: viewportWidth - right - width,
  };
}

export function chatBoxesOverlap(a: ChatBox, b: ChatBox, gap = 0): boolean {
  return !(
    a.left + a.width + gap <= b.left ||
    b.left + b.width + gap <= a.left ||
    a.top + a.height + gap <= b.top ||
    b.top + b.height + gap <= a.top
  );
}

export function chatMobileKeyboardCovered({
  innerHeight,
  viewportHeight,
  viewportOffsetTop,
  threshold = CHAT_MOBILE_KEYBOARD_PX,
}: {
  innerHeight: number;
  viewportHeight: number;
  viewportOffsetTop: number;
  threshold?: number;
}): { covered: number; keyboardOpen: boolean } {
  const covered = Math.max(
    0,
    innerHeight - viewportHeight - viewportOffsetTop,
  );
  return { covered, keyboardOpen: covered > threshold };
}

/**
 * Encaixa o shell do chat no visualViewport quando o teclado cobre a aba.
 * Vale no iPhone e no iPad (inclusive landscape ≥ 1024px) — o breakpoint
 * desktop não isenta o WebKit de empurrar o composer para trás do teclado.
 */
export function chatKeyboardShellStyle({
  viewportHeight,
  viewportOffsetTop,
  viewportWidth,
  viewportOffsetLeft = 0,
  paddingPx = 4,
  minHeightPx = 220,
}: {
  viewportHeight: number;
  viewportOffsetTop: number;
  viewportWidth?: number;
  viewportOffsetLeft?: number;
  paddingPx?: number;
  minHeightPx?: number;
}): {
  top: number;
  height: number;
  left: number | null;
  width: number | null;
} {
  const top = Math.max(0, viewportOffsetTop) + paddingPx;
  const height = Math.max(minHeightPx, viewportHeight - paddingPx * 2);
  const shiftX = Math.max(0, viewportOffsetLeft);
  if (shiftX > 0 && viewportWidth != null) {
    return {
      top,
      height,
      left: shiftX + paddingPx,
      width: Math.max(200, viewportWidth - paddingPx * 2),
    };
  }
  return { top, height, left: null, width: null };
}

/**
 * Altura ocupada pelo chat ABERTO, do topo ao fundo do viewport.
 * Com `launcherBelowPanel`, o X vermelho fica solto abaixo do card
 * (bug da ficha no iPad/desktop baixo — print do Lucas).
 */
export function chatOpenOccupiedHeight({
  viewportHeight,
  bottomInset,
  topInset,
  launcherBelowPanel,
  panelMax = CHAT_LAYOUT.panelMaxPx,
  fabPx = CHAT_LAYOUT.fabPx,
  fabGapPx = CHAT_LAYOUT.fabGapPx,
  panelReserve = 0,
}: {
  viewportHeight: number;
  bottomInset: number;
  topInset: number;
  launcherBelowPanel: boolean;
  panelMax?: number;
  fabPx?: number;
  fabGapPx?: number;
  panelReserve?: number;
}): number {
  const launcher = launcherBelowPanel ? fabPx + fabGapPx : 0;
  const reserved = panelReserve > 0 ? panelReserve : topInset + bottomInset + launcher;
  const panel = Math.min(panelMax, Math.max(0, viewportHeight - reserved));
  return topInset + panel + launcher + bottomInset;
}

export function chatOpenPanelBox({
  viewportWidth,
  viewportHeight,
  desktop,
}: {
  viewportWidth: number;
  viewportHeight: number;
  desktop: boolean;
}): {
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
} {
  const inset = desktop
    ? CHAT_LAYOUT.openDesktopInsetPx
    : CHAT_LAYOUT.openMobileInsetPx;
  if (desktop) {
    const maxH = viewportHeight - inset.top - inset.bottom;
    const height = Math.min(CHAT_LAYOUT.panelMaxPx, Math.max(0, maxH));
    const width = Math.min(
      CHAT_LAYOUT.panelWidthPx,
      Math.max(0, viewportWidth - inset.right * 2),
    );
    return {
      width,
      height,
      top: viewportHeight - inset.bottom - height,
      left: viewportWidth - inset.right - width,
      right: inset.right,
      bottom: inset.bottom,
    };
  }
  return {
    width: Math.max(0, viewportWidth - inset.right * 2),
    height: Math.max(0, viewportHeight - inset.top - inset.bottom),
    top: inset.top,
    left: inset.right,
    right: inset.right,
    bottom: inset.bottom,
  };
}

export function chatBoxInsideViewport(
  box: { top: number; left: number; width: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  epsilon = 0.5,
): boolean {
  return (
    box.top >= -epsilon &&
    box.left >= -epsilon &&
    box.top + box.height <= viewportHeight + epsilon &&
    box.left + box.width <= viewportWidth + epsilon
  );
}
