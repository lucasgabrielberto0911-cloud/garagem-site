"use client";

import { useRef, useState } from "react";
import { edgeScrollDelta, photoIndexAt } from "@/lib/photo-sort";


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

    // Última posição do ponteiro: o loop de quadros reaproveita com o dedo parado na borda.
    const pointer = { x: 0, y: 0, known: false };
    let frame = 0;
    function update() {
      if (!pointer.known) return;
      // Pela geometria dos itens, não por elementFromPoint: barras fixas (rodapé do wizard,
      // navegação) cobrem o fim da tela e mascarariam o item sob o ponteiro.
      const boxes = Array.from(list.querySelectorAll<HTMLElement>("[data-photo-index]"), item => {
        const box = item.getBoundingClientRect();
        return { index: Number(item.dataset.photoIndex), left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      });
      const next = photoIndexAt(boxes, pointer.x, pointer.y);
      if (next !== null && Number.isFinite(next) && next !== over.current) setOver(next);
    }
    function tick() {
      const delta = edgeScrollDelta(pointer.y, window.innerHeight);
      if (pointer.known && delta) {
        window.scrollBy({ top: delta, behavior: "instant" });
        update();
      }
      frame = requestAnimationFrame(tick);
    }
    function onMove(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.known = true;
      update();
    }
    function end(event: PointerEvent, cancelled: boolean) {
      if (event.pointerId !== pointerId) return;
      cancelAnimationFrame(frame);
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
    frame = requestAnimationFrame(tick);
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
