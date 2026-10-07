export type ConnectionHints = {
  online?: boolean;
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
};

/** Economia só em trabalho antecipado; a imagem escolhida mantém a qualidade. */
export function allowsSpeculativeLoading(hints: ConnectionHints) {
  if (hints.online === false || hints.saveData) return false;
  if (["slow-2g", "2g", "3g"].includes(hints.effectiveType ?? "")) return false;
  if (typeof hints.downlink === "number" && hints.downlink < 1) return false;
  return true;
}
