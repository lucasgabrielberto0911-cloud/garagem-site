"use client";

import Image from "next/image";
import { useState } from "react";

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
  /** 1–100; cards ~65–70, hero/galeria ~75. */
  quality?: number;
}) {
  const [failed, setFailed] = useState(false);
  const finalSrc = !src || failed ? VEHICLE_PLACEHOLDER : src;

  const common = {
    className,
    unoptimized,
    priority,
    quality,
    onError: () => setFailed(true),
  };

  if (fill) {
    return (
      <Image
        src={finalSrc}
        alt={alt}
        fill
        sizes={sizes}
        {...common}
      />
    );
  }

  return (
    <Image
      src={finalSrc}
      alt={alt}
      width={width ?? 160}
      height={height ?? 120}
      {...common}
    />
  );
}
