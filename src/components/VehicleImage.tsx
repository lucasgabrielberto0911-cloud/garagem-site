import { NativeRemoteFillImage } from "@/components/NativeRemoteFillImage";
import { publicVehiclePhotoSrc, publicPhotoSrcSet } from "@/lib/public-photo-url";
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
  preloadImage,
  fadeIn = false,
  decoding,
  srcSet,
  mobileSrcSet,
  recoverable = false,
  onReady,
  onErrorState,
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
  onReady?: () => void;
  onErrorState?: () => void;
  className?: string;
  /**
   * Aceito por compatibilidade. As fotos públicas já são WebP
   * (upload ou transformação do Storage) e não passam por /_next/image.
   */
  unoptimized?: boolean;
  /** Fotos principais da 1ª dobra: alta prioridade e carregamento imediato. */
  priority?: boolean;
  /** Demais fotos da 1ª dobra: carregam cedo com prioridade normal (auto). */
  eager?: boolean;
  /** Controla `<link rel="preload">` separado de `priority` (padrão: acompanha `priority`). */
  preloadImage?: boolean;
  /** Aplica fade-in suave sobre o LQIP/placeholder quando o JS hidrata (sem depender de JS). */
  fadeIn?: boolean;
  decoding?: "sync" | "async" | "auto";
  /**
   * Aceito por compatibilidade e ignorado.
   * Qualidades diferentes multiplicavam a cota de imagens.
   */
  quality?: number;
}) {
  const finalSrc = publicVehiclePhotoSrc(src || VEHICLE_PLACEHOLDER);
  const finalSet = publicPhotoSrcSet(srcSet, publicVehiclePhotoSrc);
  const mobileSet = publicPhotoSrcSet(mobileSrcSet, publicVehiclePhotoSrc);

  // Só a capa do LCP entra no preload. A 2ª foto pode usar fetchPriority="high"
  // sem duplicar <link rel="preload">; o restante da 1ª dobra usa eager + auto.
  const shouldPreload = preloadImage ?? priority;
  if (shouldPreload) {
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
        fadeIn={fadeIn}
        decoding={decoding}
        recoverable={recoverable}
        onReady={onReady}
        onErrorState={onErrorState}
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
