"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
};

/** Troca o `window.confirm` pela mesma janela de confirmação do painel. */
export function useConfirmDialog(): [
  (options: ConfirmOptions) => Promise<boolean>,
  ReactNode,
] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOptions(next);
      }),
    [],
  );

  function close(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }

  const dialog = (
    <ConfirmDialog
      open={options !== null}
      title={options?.title ?? ""}
      description={options?.description}
      confirmLabel={options?.confirmLabel}
      danger={options?.danger ?? false}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  );
  return [confirm, dialog];
}

export function confirmDiscard(
  confirm: (options: ConfirmOptions) => Promise<boolean>,
  what: string,
) {
  return confirm({
    title: "Descartar alterações?",
    description: `As alterações ${what} ainda não foram salvas.`,
    confirmLabel: "Descartar",
  });
}
