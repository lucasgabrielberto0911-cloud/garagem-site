/** Only HEIC/HEIF bypasses browser compression and needs a source-size limit. */
export function isOversizedHeic(file: { name: string; type: string; size: number }) {
  const heic = /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type);
  return heic && file.size > 3 * 1024 * 1024;
}
