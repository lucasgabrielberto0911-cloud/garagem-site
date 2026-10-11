type PhotoFiles = { url: string; thumbnailUrl?: string | null };

/**
 * Miniaturas que o anúncio deixou de usar em fotos que continuam nele (a capa
 * foi reenquadrada). Fotos removidas, giradas ou borradas já saem por outro
 * caminho, pois a URL da galeria também muda.
 */
export function replacedThumbnails(previous: PhotoFiles[], next: PhotoFiles[]) {
  const keptUrls = new Set(next.map((photo) => photo.url));
  const keptThumbnails = new Set(next.flatMap((photo) => (photo.thumbnailUrl ? [photo.thumbnailUrl] : [])));
  return [
    ...new Set(
      previous.flatMap((photo) =>
        photo.thumbnailUrl && keptUrls.has(photo.url) && !keptThumbnails.has(photo.thumbnailUrl)
          ? [photo.thumbnailUrl]
          : [],
      ),
    ),
  ];
}
