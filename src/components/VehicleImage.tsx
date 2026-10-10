import { NativeRemoteFillImage } from "@/components/NativeRemoteFillImage";
import { publicPhotoSrc, publicPhotoSrcSet } from "@/lib/public-photo-url";
import { preload } from "react-dom";

export const VEHICLE_PLACEHOLDER = "/branding/placeholder-car.png";

export function VehicleImage({
  src,
  alt,
  fill = false,
  width,
  height,
  sizes,
  className = "",
  priority = false,
  srcSet,
  mobileSrcSet,
  recoverable = false,
}: {
  src?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  srcSet?: string;
  mobileSrcSet?: string;
  /** Galeria pública: recupera falhas sem colocar botão dentro de um link de card. */
  recoverable?: boolean;
  className?: string;
  /**
   * Aceito por compatibilidade. As fotos públicas já são WebP
   * (upload ou transformação do Storage) e não passam por /_next/image.
   */
  unoptimized?: boolean;
  priority?: boolean;
  /**
   * Aceito por compatibilidade e ignorado.
   * Qualidades diferentes multiplicavam a cota de imagens.
   */
  quality?: number;
}) {
  const finalSrc = publicPhotoSrc(src || VEHICLE_PLACEHOLDER);
  const finalSet = publicPhotoSrcSet(srcSet);
  const mobileSet = publicPhotoSrcSet(mobileSrcSet);

  // Match the <picture> selection: never preload a desktop derivative on a
  // phone. Only the already-prioritized first photos get a resource hint.
  if (priority) {
    const options = { as: "image" as const, fetchPriority: "high" as const,
      imageSizes: finalSet || mobileSet ? sizes : undefined };
    if (mobileSet) {
      preload(finalSrc, { ...options, imageSrcSet: mobileSet, media: "(max-width: 639px)" });
      preload(finalSrc, { ...options, imageSrcSet: finalSet, media: "(min-width: 640px)" });
    } else {
      preload(finalSrc, { ...options, imageSrcSet: finalSet });
    }
  }

  if (fill) {
    return (
      <NativeRemoteFillImage
        src={finalSrc}
        alt={alt}
        width={width ?? 480}
        height={height ?? 300}
        sizes={sizes}
        srcSet={finalSet}
        mobileSrcSet={mobileSet}
        className={className}
        priority={priority}
        recoverable={recoverable}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- fotos públicas sem /_next/image
    <img
      src={finalSrc}
      alt={alt}
      width={width ?? 160}
      height={height ?? 120}
      className={className}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "low"}
    />
  );
}
