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
  eager = false,
  decoding,
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
  /** Primeira foto visível: preload, alta prioridade e decodificação imediata. */
  priority?: boolean;
  /** Foto da primeira dobra que não é o LCP: baixa cedo, sem disputar a capa. */
  eager?: boolean;
  decoding?: "sync" | "async" | "auto";
  /**
   * Aceito por compatibilidade e ignorado.
   * Qualidades diferentes multiplicavam a cota de imagens.
   */
  quality?: number;
}) {
  const finalSrc = publicPhotoSrc(src || VEHICLE_PLACEHOLDER);
  const finalSet = publicPhotoSrcSet(srcSet);
  const mobileSet = publicPhotoSrcSet(mobileSrcSet);

  // Só a capa do LCP entra no preload. A segunda foto da grade baixa
  // junto, mas sem prioridade alta — senão as duas dividem a rede lenta.
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
        eager={eager}
        decoding={decoding}
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
      loading={priority || eager ? "eager" : "lazy"}
      decoding={decoding ?? (priority ? "sync" : "async")}
      fetchPriority={priority ? "high" : eager ? "auto" : "low"}
    />
  );
}
