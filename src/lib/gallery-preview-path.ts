/** Nome versionado: somente uploads com o preview pronto recebem -g800. */
export function readyGalleryPath(id: string, extension = "webp") {
  return `${id}-g800.${extension}`;
}

export function galleryPreviewObjectPath(path: string): string | null {
  return /-g800\.(?:webp|jpe?g)$/i.test(path)
    ? path.replace(/\.(?:webp|jpe?g)$/i, "-preview.webp")
    : null;
}
