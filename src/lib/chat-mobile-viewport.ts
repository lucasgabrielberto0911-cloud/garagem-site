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
  /** FAB fechado no desktop, acima do WhatsApp float (6.25rem). */
  closedDesktopBottomPx: 100,
  /** FAB fechado no mobile, acima da bottom nav. */
  closedMobileNavBottomPx: 84,
  /** FAB fechado na ficha, acima da sticky WhatsApp (~8.5rem). */
  closedFichaStickyBottomPx: 136,
  openDesktopInsetPx: { top: 16, right: 24, bottom: 20 },
  openMobileInsetPx: { top: 8, right: 8, bottom: 8 },
} as const;

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
