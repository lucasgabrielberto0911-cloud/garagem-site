import { IconStar } from "@/components/admin/icons";
import { CONSIGNED_HINT, CONSIGNED_LABEL } from "@/lib/vehicle-ops";
import {
  VEHICLE_LOCATION_CITIES,
  VEHICLE_LOCATION_HINT,
} from "@/lib/vehicle-location";
import {
  errorBorder,
  SEGMENT,
  SEGMENT_ON,
  SEGMENT_OFF,
  type VehicleFormProps,
} from "../types";
import type { VehicleFormModel } from "../useVehicleFormState";

export function MoreDetailsSection({
  form,
  vehicle,
}: {
  form: Pick<
    VehicleFormModel,
    | "locationCity"
    | "setLocationCity"
    | "setDirty"
    | "setErrors"
    | "errors"
    | "consigned"
    | "setConsigned"
  >;
  vehicle?: VehicleFormProps["vehicle"];
}) {
  const {
    locationCity,
    setLocationCity,
    setDirty,
    setErrors,
    errors,
    consigned,
    setConsigned,
  } = form;
  return (
    <div className="col-span-2 border-t border-white/10 pt-3">
      <p className="font-display text-xs font-semibold uppercase tracking-wider text-cream">
        Mais opções
      </p>

      <div
        id="vehicle-more-options"
        className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4"
      >
        <div className="col-span-2 sm:col-span-1">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted">
            Onde está o veículo *
          </span>
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label="Onde está o veículo"
          >
            {VEHICLE_LOCATION_CITIES.map((option) => {
              const selected = locationCity === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (option.value !== locationCity) setDirty(true);
                    setLocationCity(option.value);
                    setErrors((current) => {
                      const next = { ...current };
                      delete next.locationCity;
                      return next;
                    });
                  }}
                  className={`${SEGMENT} ${selected ? SEGMENT_ON : SEGMENT_OFF} ${
                    errors.locationCity ? errorBorder : ""
                  }`}
                >
                  <span className="font-display text-sm font-semibold uppercase tracking-wide">
                    {option.label}
                  </span>
                  <span className="text-xs uppercase tracking-wider opacity-70">
                    ES
                  </span>
                </button>
              );
            })}
          </div>
          {!locationCity && !errors.locationCity ? (
            <p className="mt-1.5 text-xs text-muted">
              Selecione a cidade onde o veículo está.
            </p>
          ) : null}
          {errors.locationCity ? (
            <p className="mt-1.5 text-xs text-red-400">{errors.locationCity}</p>
          ) : (
            <details className="mt-1.5 text-xs text-muted">
              <summary className="cursor-pointer py-1 touch-manipulation">
                Para que serve?
              </summary>
              <p className="mt-1 leading-relaxed">{VEHICLE_LOCATION_HINT}</p>
            </details>
          )}
        </div>

        <div className="col-span-2 sm:col-span-1">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted">
            Vitrine
          </span>
          <label className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 border border-white/10 bg-ink px-3 py-2.5 text-sm text-cream transition touch-manipulation hover:border-brand/50">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={vehicle?.featured ?? false}
              className="h-5 w-5 accent-brand"
            />
            <IconStar className="h-4 w-4 text-brand-yellow" />
            Destaque na home
          </label>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Até 8 na home, só disponível. A home não escolhe carro sozinha.
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted">
            Interno · não aparece no site
          </span>
          <label
            className={`flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 border px-3 py-2.5 text-sm text-cream transition touch-manipulation hover:border-brand/50 ${
              consigned
                ? "border-sky-400/50 bg-sky-400/10"
                : "border-white/10 bg-ink"
            }`}
          >
            <input
              type="checkbox"
              name="consigned"
              checked={consigned}
              onChange={(event) => setConsigned(event.target.checked)}
              className="h-5 w-5 accent-brand"
              data-testid="consigned-checkbox"
            />
            {CONSIGNED_LABEL}
          </label>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            {CONSIGNED_HINT}
          </p>
        </div>
      </div>
    </div>
  );
}
