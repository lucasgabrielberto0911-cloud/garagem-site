/** Textos do status do rascunho: curtos, para uma linha pequena e cinza. */

export type DraftStatusKind =
  | "loading"
  | "idle"
  | "pending"
  | "saved"
  | "error"
  | "conflict";

function clock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function draftStatusText(input: {
  status: DraftStatusKind;
  savedAt: string | null;
}): string {
  switch (input.status) {
    case "pending":
      return "Salvando…";
    case "error":
      return "Sem conexão: cópia no aparelho";
    case "conflict":
      return "Outra aba mexeu no rascunho";
    default: {
      const at = input.savedAt ? clock(input.savedAt) : "";
      return at ? `Salvo às ${at}` : "Rascunho automático";
    }
  }
}

/** "Rascunho: Honda Civic 2019, hoje às 18:04" (data só quando não é hoje). */
export function draftBannerLabel(
  draft: Record<string, unknown>,
  updatedAt: string | null,
  now: Date = new Date(),
): string {
  const text = (key: string) =>
    typeof draft[key] === "string" ? (draft[key] as string).trim() : "";
  const name = [text("brand"), text("model"), text("year")]
    .filter(Boolean)
    .join(" ");
  const date = updatedAt ? new Date(updatedAt) : null;
  let when = "";
  if (date && !Number.isNaN(date.getTime())) {
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday =
      new Date(now.getTime() - 86400000).toDateString() ===
      date.toDateString();
    const day = sameDay
      ? "hoje"
      : yesterday
        ? "ontem"
        : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    when = `${day} às ${clock(updatedAt!)}`;
  }
  return `Rascunho: ${name || "veículo sem nome"}${when ? `, ${when}` : ""}`;
}
