/**
 * Teclado virtual no chat: o visualViewport encolhe; o inset de baixo
 * é a área coberta (iOS/Android). Acima do limiar, o painel cola no
 * viewport visível para o campo não ficar atrás do teclado.
 */
export const CHAT_MOBILE_KEYBOARD_PX = 80;

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
