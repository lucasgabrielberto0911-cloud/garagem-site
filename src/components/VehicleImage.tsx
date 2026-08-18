import Image from "next/image";

export const VEHICLE_PLACEHOLDER = "/branding/placeholder-car.png";

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
  quality = 70,
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
  /** 1–100; cards ~60–70, hero/galeria ~75. */
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
        quality={quality}
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
      quality={quality}
    />
  );
}
