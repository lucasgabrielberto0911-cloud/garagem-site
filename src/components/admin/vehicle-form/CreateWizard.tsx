import { useEffect, useRef, useState } from "react";
import {
  SECTIONS_BY_STEP,
  type VehicleWizardStep,
} from "@/lib/admin-form-sections";
import { stepForField } from "@/lib/admin-vehicle-form-validate";
import { VEHICLE_LOCATION_CITIES } from "@/lib/vehicle-location";
import { VehicleWizardNav } from "@/components/admin/VehicleWizardNav";
import { IdentitySection } from "./sections/IdentitySection";
import { PriceStatusSection } from "./sections/PriceStatusSection";
import { PhotosSection } from "./sections/PhotosSection";
import { SpecsSection } from "./sections/SpecsSection";
import { LegendSection } from "./sections/LegendSection";
import { MoreDetailsSection } from "./sections/MoreDetailsSection";
import { OperationSection } from "./sections/OperationSection";
import { SubmitButton } from "./SubmitButton";
import type { VehicleFormProps } from "./types";
import type { VehicleFormModel } from "./useVehicleFormState";

export type WizardLayoutProps = {
  form: VehicleFormModel;
  vehicle?: VehicleFormProps["vehicle"];
  mode: VehicleFormProps["mode"];
  adminId: string;
};

/** Cidade, destaque, consignado e custos internos: recolhidos, com resumo de uma linha. */
function PriceMoreDetails({
  form,
  vehicle,
}: {
  form: VehicleFormModel;
  vehicle?: VehicleFormProps["vehicle"];
}) {
  const { locationCity, errors, consigned } = form;
  const hasError = Boolean(errors.locationCity || errors.purchasePrice);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!hasError) return;
    setOpen(true);
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [hasError]);
  const city = VEHICLE_LOCATION_CITIES.find(
    (option) => option.value === locationCity,
  )?.label;
  return (
    <details
      ref={ref}
      id="vehicle-more-details"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="border border-white/10 bg-ink/50"
    >
      <summary className="flex min-h-11 cursor-pointer touch-manipulation flex-wrap items-center gap-x-2 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-cream sm:px-5">
        Mais detalhes (opcional)
        <span
          className={`font-body text-xs font-normal normal-case tracking-normal ${errors.locationCity ? "text-red-400" : "text-muted"}`}
        >
          {city ? `Cidade ${city}` : "Falta a cidade"}
          {consigned ? " · Consignado" : ""}
        </span>
      </summary>
      <div className="space-y-4 border-t border-white/10 p-4 sm:p-5">
        <MoreDetailsSection form={form} vehicle={vehicle} />
        <OperationSection form={form} />
      </div>
    </details>
  );
}

export function CreateWizard({
  form,
  vehicle,
  mode,
  adminId,
}: WizardLayoutProps) {
  const {
    step,
    description,
    errors,
    saving,
    draftSaving,
    photosUploading,
    changeStep,
    validate,
  } = form;
  const visible = SECTIONS_BY_STEP[step];
  return (
    <>
      <div hidden={!visible.includes("fotos")}>
        <PhotosSection form={form} vehicle={vehicle} adminId={adminId} />
      </div>
      <div hidden={!visible.includes("identificacao")}>
        <IdentitySection form={form} />
      </div>
      <div hidden={!visible.includes("ficha")}>
        <SpecsSection form={form} vehicle={vehicle} collapseAdvanced />
      </div>
      <div hidden={!visible.includes("essencial")}>
        <PriceStatusSection form={form} />
      </div>
      <input type="hidden" name="description" value={description} />
      <div hidden={!visible.includes("itens")}>
        <LegendSection form={form} />
      </div>
      <div hidden={!visible.includes("operacao")}>
        <PriceMoreDetails form={form} vehicle={vehicle} />
      </div>
      <VehicleWizardNav
        step={step}
        errorSteps={([1, 2, 3, 4] as const).filter((candidate) =>
          Object.keys(errors).some(
            (field) => stepForField(field, "create") === candidate,
          ),
        )}
        disabled={saving || draftSaving}
        onBack={() => changeStep((step - 1) as VehicleWizardStep)}
        onNext={() => {
          if (validate(step)) changeStep((step + 1) as VehicleWizardStep);
        }}
      >
        <SubmitButton
          pending={saving}
          label={mode === "create" ? "Cadastrar veículo" : "Salvar alterações"}
          disabled={photosUploading || draftSaving}
        />
      </VehicleWizardNav>
    </>
  );
}
