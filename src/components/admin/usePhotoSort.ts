"use client";

import { useRef, useState } from "react";

const EDGE_PX = 70;
const SCROLL_STEP = 14;

/**
 * Reordenar fotos com pointer events (mouse, toque e caneta) a partir de uma alça.
 * Só a alça tem `touch-action: none`, então a rolagem da página continua livre no resto da foto.
 * Cada item da grade precisa de `data-photo-index`.
 */
export function usePhotoSort(onReorder: (from: number, to: number) => void, count: number) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const over = useRef<number | null>(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  function setOver(index: number | null) {
    over.current = index;
    setOverIndex(index);
  }

  // O gesto roda em listeners na janela (não nos handlers do React): o estado do arraste fica em ref
  // e não depende de re-render entre um pointermove e o pointerup seguinte.
  function startDrag(index: number, pointerId: number, list: ParentNode) {
    setDragIndex(index);
    setOver(index);

    function onMove(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      // Pela geometria dos itens, não por elementFromPoint: barras fixas (rodapé do wizard,
      // navegação) cobrem o fim da tela e mascarariam o item sob o ponteiro.
      let next: number | null = null;
      for (const item of list.querySelectorAll<HTMLElement>("[data-photo-index]")) {
        const box = item.getBoundingClientRect();
        if (event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom) {
          next = Number(item.dataset.photoIndex);
          break;
        }
      }
      if (next !== null && Number.isFinite(next) && next !== over.current) setOver(next);
      if (event.clientY < EDGE_PX) window.scrollBy({ top: -SCROLL_STEP, behavior: "instant" });
      else if (event.clientY > window.innerHeight - EDGE_PX) window.scrollBy({ top: SCROLL_STEP, behavior: "instant" });
    }
    function end(event: PointerEvent, cancelled: boolean) {
      if (event.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      const to = over.current;
      setDragIndex(null);
      setOver(null);
      if (!cancelled && to !== null && to !== index) onReorderRef.current(index, to);
    }
    function onUp(event: PointerEvent) {
      end(event, false);
    }
    function onCancel(event: PointerEvent) {
      end(event, true);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  }

  function handleProps(index: number) {
    return {
      onPointerDown(event: React.PointerEvent<HTMLElement>) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* o gesto segue pelos listeners da janela */
        }
        startDrag(index, event.pointerId, event.currentTarget.closest("ul, ol") ?? document);
      },
      onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
        const delta =
          event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : event.key === "ArrowRight" || event.key === "ArrowDown"
              ? 1
              : 0;
        if (event.key === "Home") {
          event.preventDefault();
          onReorder(index, 0);
        } else if (event.key === "End") {
          event.preventDefault();
          onReorder(index, count - 1);
        } else if (delta) {
          event.preventDefault();
          onReorder(index, index + delta);
        }
      },
    };
  }

  return { dragIndex, overIndex, handleProps };
}
