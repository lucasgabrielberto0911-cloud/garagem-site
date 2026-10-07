import { NativeRemoteFillImage } from "@/components/NativeRemoteFillImage";
import { publicPhotoSrc, publicPhotoSrcSet } from "@/lib/public-photo-url";

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

  if (fill) {
    return (
      <NativeRemoteFillImage
        src={finalSrc}
        alt={alt}
        width={width ?? 480}
        height={height ?? 300}
        sizes={sizes}
        srcSet={publicPhotoSrcSet(srcSet)}
        mobileSrcSet={publicPhotoSrcSet(mobileSrcSet)}
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
      decoding="async"
      fetchPriority={priority ? "high" : "low"}
    />
  );
}
