import Image from "next/image";

export const VEHICLE_PLACEHOLDER = "/branding/placeholder-car.png";

/** Uma quality só: a mesma foto+width não vira várias transformações na Vercel. */
const VEHICLE_IMAGE_QUALITY = 65;

export function VehicleImage({
  src,
  alt,
  fill = false,
  width,
  height,
  sizes,
  className = "",
  unoptimized = false,
  priority = false,
}: {
  src?: string | null;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  unoptimized?: boolean;
  priority?: boolean;
  /**
   * Aceito por compatibilidade e ignorado.
   * Sempre 65 — quality diferente por chamada multiplicava a cota de imagens.
   */
  quality?: number;
}) {
  const finalSrc = src || VEHICLE_PLACEHOLDER;

  if (fill) {
    return (
      <Image
        src={finalSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        unoptimized={unoptimized}
        priority={priority}
        quality={VEHICLE_IMAGE_QUALITY}
      />
    );
  }

  return (
    <Image
      src={finalSrc}
      alt={alt}
      width={width ?? 160}
      height={height ?? 120}
      className={className}
      unoptimized={unoptimized}
      priority={priority}
      quality={VEHICLE_IMAGE_QUALITY}
    />
  );
}
