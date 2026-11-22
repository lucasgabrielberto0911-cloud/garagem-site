"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconCheck, IconCopy } from "@/components/admin/icons";
import { btn } from "@/components/admin/ui";

export function CatalogFeedCopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link do feed copiado.");
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione o link acima.");
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={`${btn.primary} w-full shrink-0 sm:w-auto`}
    >
      {copied ? (
        <>
          <IconCheck className="h-4 w-4" />
          Link copiado
        </>
      ) : (
        <>
          <IconCopy className="h-4 w-4" />
          Copiar link
        </>
      )}
    </button>
  );
}
