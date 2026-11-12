export type SuggestionIconKind =
  | "gear"
  | "finance"
  | "price"
  | "video"
  | "trade"
  | "warranty"
  | "whatsapp"
  | "other";

/** Ícone pelo assunto do atalho, não pela posição: a lista muda com o contexto. */
export function suggestionIconKind(text: string): SuggestionIconKind {
  const t = text.toLowerCase();
  if (/autom[aá]tic|c[aâ]mbio/.test(t)) return "gear";
  if (/financ|parcel|prestac/.test(t)) return "finance";
  if (/\bmil\b|preço|r\$/.test(t)) return "price";
  if (/v[ií]deo/.test(t)) return "video";
  if (/troca|usado/.test(t)) return "trade";
  if (/garantia|condi[cç]/.test(t)) return "warranty";
  if (/consultor|avisar|encomendar/.test(t)) return "whatsapp";
  return "other";
}
