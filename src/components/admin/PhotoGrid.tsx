"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { IconGrip } from "@/components/admin/icons";
import { usePhotoSort } from "@/components/admin/usePhotoSort";

type PhotoGridProps = {
  /** Ids estáveis das fotos, na ordem atual (a key do item usa o id, não o índice). */
  ids: string[];
  onReorder: (from: number, to: number) => void;
  disabled?: boolean;
  children: (index: number) => ReactNode;
};

/** Grade de fotos: 2 colunas no celular, reordenar pela alça (⠿) com toque, mouse ou teclado. */
export function PhotoGrid({ ids, onReorder, disabled = false, children }: PhotoGridProps) {
  const count = ids.length;
  const focusId = useRef<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { dragIndex, overIndex, handleProps } = usePhotoSort((from, to) => {
    const target = Math.max(0, Math.min(count - 1, to));
    if (target === from) return;
    focusId.current = ids[from] ?? null;
    onReorder(from, target);
  }, count);

  // O foco do teclado acompanha a foto movida (a alça dela mudou de posição).
  useLayoutEffect(() => {
    const id = focusId.current;
    if (!id) return;
    focusId.current = null;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-photo-id="${CSS.escape(id)}"] button[data-photo-handle]`)
      ?.focus();
  }, [ids]);
  return (
    <ul ref={listRef} className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4">
      {ids.map((id, index) => {
        const isDragging = dragIndex === index;
        const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
        return (
          <li
            key={id}
            data-photo-id={id}
            data-photo-index={index}
            className={`relative overflow-hidden border bg-asphalt ${
              isDragging
                ? "border-brand opacity-60"
                : isOver
                  ? "border-brand ring-2 ring-brand/40"
                  : "border-white/10"
            }`}
          >
            {children(index)}
            <button
              type="button"
              data-photo-handle
              disabled={disabled}
              aria-label={`Reordenar foto ${index + 1}. Arraste ou use as setas do teclado.`}
              title="Arraste para reordenar"
              {...handleProps(index)}
              className="absolute right-1 top-1 inline-flex h-11 w-11 cursor-grab touch-none select-none items-center justify-center bg-asphalt/80 text-cream active:cursor-grabbing disabled:opacity-40"
            >
              <IconGrip className="h-5 w-5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
