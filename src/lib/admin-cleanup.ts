export const PHOTO_CLEANUP_GRACE_MS = 48 * 60 * 60 * 1000;
/** Sem data conhecida não há evidência suficiente para remover um arquivo. */
export function isCleanupCandidate(
  file: {
    name: string;
    created_at?: string | null;
    updated_at?: string | null;
  },
  references: ReadonlySet<string>,
  now = Date.now(),
) {
  const time = Math.max(
    Date.parse(file.created_at || "") || 0,
    Date.parse(file.updated_at || "") || 0,
  );
  return Boolean(
    time && !references.has(file.name) && time < now - PHOTO_CLEANUP_GRACE_MS,
  );
}
