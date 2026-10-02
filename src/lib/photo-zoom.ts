type Offset = { x: number; y: number };
type PhotoViewport = {
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
  scale: number;
};

/** Limita o arraste à foto contida na janela, sem expor espaço além da imagem. */
export function clampPhotoOffset(offset: Offset, viewport: PhotoViewport): Offset {
  const { width, height, imageWidth, imageHeight, scale } = viewport;
  if ([width, height, imageWidth, imageHeight, scale].some((value) => !Number.isFinite(value) || value <= 0)) {
    return { x: 0, y: 0 };
  }
  const fit = Math.min(width / imageWidth, height / imageHeight);
  const maxX = Math.max(0, (imageWidth * fit * scale - width) / 2);
  const maxY = Math.max(0, (imageHeight * fit * scale - height) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, offset.x)),
    y: Math.max(-maxY, Math.min(maxY, offset.y)),
  };
}
