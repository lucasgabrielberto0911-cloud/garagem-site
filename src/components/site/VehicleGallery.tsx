"use client";

import { useState } from "react";
import { VehicleImage } from "@/components/VehicleImage";

export function VehicleGallery({
  photos,
  alt,
}: {
  photos: { id: string; url: string }[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  const current = photos[active];

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden border border-white/10 bg-ink">
        <VehicleImage
          src={current?.url}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
        />
      </div>

      {photos.length > 1 ? (
        <ul className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Ver foto ${index + 1} de ${photos.length}`}
                aria-current={index === active}
                className={`relative block aspect-[4/3] w-full overflow-hidden border bg-ink transition ${
                  index === active
                    ? "border-brand"
                    : "border-white/10 hover:border-white/30"
                }`}
              >
                <VehicleImage
                  src={photo.url}
                  alt=""
                  fill
                  sizes="120px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
