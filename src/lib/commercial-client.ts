export async function fetchDocFile(id: string, kind: string, number?: number): Promise<File | null> {
  try {
    const r = await fetch(`/api/admin/documentos/${id}`);
    if (!r.ok || !r.headers.get("content-type")?.includes("application/pdf")) return null;
    return new File([await r.blob()], `garagem-${kind}-${number ?? id}.pdf`, { type: "application/pdf" });
  } catch {
    return null;
  }
}

export async function shareDocFile(
  doc: { id: string; kind: string; number?: number; file?: File | null },
  callbacks?: {
    onFileDownloaded?: (file: File) => void;
    onError?: (msg: string) => void;
  }
) {
  let file = doc.file ?? null;
  if (!file) {
    file = await fetchDocFile(doc.id, doc.kind, doc.number);
    if (!file) {
      callbacks?.onError?.("Não foi possível baixar o PDF. Tente novamente.");
      return;
    }
    callbacks?.onFileDownloaded?.(file);
  }
  const isReceipt = doc.kind === "recibo";
  const label = `${isReceipt ? "Recibo" : "Contrato"}${doc.number ? ` nº ${doc.number}` : ""} - Garagem`;
  if (file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: label, text: label }).catch(() => {});
  } else if (typeof window !== "undefined") {
    window.open(`https://wa.me/?text=${encodeURIComponent(label)}`, "_blank", "noopener");
  }
}

/** O RG digitado pertence ao cliente escolhido: ao trocar de cliente, o campo volta vazio (vazio mantém o cadastro). */
export function rgAfterCustomerChange(previousId: string, nextId: string, rg: string) {
  return previousId === nextId ? rg : "";
}
