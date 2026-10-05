/** A reserva de fotos não altera campos. Gravações completas usam a versão lida. */
export function draftVersionMatches(expected: unknown, current: Date | null) {
  return current ? expected === current.toISOString() : expected === null;
}
