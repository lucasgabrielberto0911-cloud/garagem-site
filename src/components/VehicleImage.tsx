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
  // Fotos remotas (Supabase) não passam pelo otimizador da Vercel: a cota
  // Hobby esgotou e /_next/image devolve 402. Placeholder local segue o
  // default do next.config.
  const skipOptimizer = unoptimized || /^https?:\/\//i.test(finalSrc);

  // Capa do card: <img> nativo baixa a miniatura com lazy/async, sem o
  // wrapper do next/image — a rolagem infinita no celular fica mais leve.
  if (fill && skipOptimizer) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={finalSrc}
        alt={alt}
        width={width ?? 480}
        height={height ?? 300}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        draggable={false}
        className={`absolute inset-0 h-full w-full ${className}`}
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={finalSrc}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        unoptimized={skipOptimizer}
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
      unoptimized={skipOptimizer}
      priority={priority}
      quality={VEHICLE_IMAGE_QUALITY}
    />
  );
}
