"use client";

import { VEHICLE_LOCATION_CITIES } from "@/lib/vehicle-location";
import { Chip, selectClass } from "../StockFilterControls";
import { useEffect, useRef } from "react";

export function FiltroCidade({ value, onChange }: {
  value: string;
  onChange: (city: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const track = trackRef.current;
    const active = track?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (track && active) track.scrollLeft = active.offsetLeft - (track.clientWidth - active.offsetWidth) / 2;
  }, [value]);

  return (
    <div className="mt-3 min-w-0">
      <div role="group" aria-label="Filtrar por cidade" className="lg:hidden">
        <p className="mb-1 text-xs text-muted">Cidade</p>
        <div ref={trackRef} className="relative flex gap-2 overflow-x-auto pb-1">
          <Chip active={!value} onClick={() => onChange("")}>Todas as cidades</Chip>
          {VEHICLE_LOCATION_CITIES.map((city) => (
            <Chip key={city.value} active={value === city.value} onClick={() => onChange(value === city.value ? "" : city.value)}>
              {city.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="hidden lg:block">
        <label htmlFor="estoque-cidade" className="mb-1 block text-xs text-muted">Cidade</label>
        <select id="estoque-cidade" name="city" value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
          <option value="">Todas as cidades</option>
          {VEHICLE_LOCATION_CITIES.map((city) => <option key={city.value} value={city.value}>{city.label}</option>)}
        </select>
      </div>
    </div>
  );
}
