export const EDGE_PX = 70;
export const SCROLL_STEP = 14;

export type PhotoBox = { index: number; left: number; right: number; top: number; bottom: number };

/** Quanto rolar por quadro com o ponteiro em `clientY`: negativo perto do topo, positivo perto do fim. */
export function edgeScrollDelta(clientY: number, viewportHeight: number): number {
  if (clientY < EDGE_PX) return -SCROLL_STEP;
  if (clientY > viewportHeight - EDGE_PX) return SCROLL_STEP;
  return 0;
}

/** Índice da foto sob o ponto (pela geometria, não por elementFromPoint), ou null. */
export function photoIndexAt(boxes: PhotoBox[], x: number, y: number): number | null {
  const hit = boxes.find(box => x >= box.left && x <= box.right && y >= box.top && y <= box.bottom);
  return hit ? hit.index : null;
}
