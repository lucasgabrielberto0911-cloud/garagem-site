import { WIZARD_STEP_LABELS } from "@/components/admin/VehicleWizardNav";
import {
  identitySummary,
  fichaSummary,
  descriptionSummary,
  accessoriesSummary,
} from "@/lib/admin-form-sections";
import type { VehicleFormModel } from "./useVehicleFormState";
import type { VehicleFormProps } from "./types";
import { MoreDetailsSection } from "./sections/MoreDetailsSection";

export function ReviewStep({
  form,
  vehicle,
  mode,
}: {
  mode: VehicleFormProps["mode"];
  form: VehicleFormModel;
  vehicle?: VehicleFormProps["vehicle"];
}) {
  const {
    step,
    errors,
    photos,
    brand,
    model,
    version,
    color,
    plate,
    year,
    yearModel,
    values,
    transmission,
    fuel,
    description,
    accessories,
    statusLabel,
  } = form;
  return (
    <div className="space-y-3">
      <h2
        id="wizard-title"
        tabIndex={-1}
        className="font-display text-lg font-semibold text-cream"
      >
        Etapa {step} de 4: {WIZARD_STEP_LABELS[step - 1]}
      </h2>
      {errors.photos && step === 1 ? (
        <p role="alert" className="text-sm text-red-400">
          {errors.photos}
        </p>
      ) : null}
      {step === 1 ? (
        <p className="text-sm text-muted">
          A primeira foto é a capa. Confira e borre placas visíveis antes de
          publicar.
        </p>
      ) : null}
      <div hidden={step !== 4} className="space-y-3 text-sm text-muted">
        <p>{photos.length} foto(s) · 1ª é a capa</p>
        <p>{identitySummary({ brand, model, version, color, plate })}</p>
        <p>
          {fichaSummary({ year, yearModel, km: values.km, transmission, fuel })}
        </p>
        <p>{descriptionSummary(description)}</p>
        <p>{accessoriesSummary(accessories)}</p>
        <p>
          {values.price ? `R$ ${values.price}` : "Sem preço"} · {statusLabel}
        </p>
        {mode === "edit" ? (
          <div className="border-t border-white/10 pt-3">
            <p className="mb-4 font-display text-xs font-semibold uppercase tracking-wider text-cream">
              Mais opções
            </p>
            <MoreDetailsSection form={form} vehicle={vehicle} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
