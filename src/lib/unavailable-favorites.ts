/** A API pública verifica até 60 ids. Cache e falha de rede não provam indisponibilidade. */
export function unavailableFavoriteIds(ids: string[], available: string[], fresh: boolean) {
  if (!fresh) return [];
  const found = new Set(available);
  return [...new Set(ids.slice(0, 60))].filter(id => !found.has(id));
}
