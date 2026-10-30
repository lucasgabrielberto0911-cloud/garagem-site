import {
  SECTIONS_BY_STEP,
  type VehicleWizardStep,
} from "@/lib/admin-form-sections";
import { stepForField } from "@/lib/admin-vehicle-form-validate";
import { VehicleWizardNav } from "@/components/admin/VehicleWizardNav";
import { IdentitySection } from "./sections/IdentitySection";
import { PriceStatusSection } from "./sections/PriceStatusSection";
import { PhotosSection } from "./sections/PhotosSection";
import { SpecsSection } from "./sections/SpecsSection";
import { LegendSection } from "./sections/LegendSection";
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
      <div className="contents">
        <div hidden={!visible.includes("identificacao")} style={{ order: 0 }}>
          <IdentitySection form={form} />
        </div>
        <div hidden={!visible.includes("essencial")} style={{ order: 2 }}>
          <PriceStatusSection form={form} />
        </div>
      </div>
      <div className="contents">
        <div hidden={!visible.includes("fotos")} style={{ order: 0 }}>
          <PhotosSection form={form} vehicle={vehicle} adminId={adminId} />
        </div>
      </div>
      <div className="contents">
        <div hidden={!visible.includes("ficha")} style={{ order: 0 }}>
          <SpecsSection form={form} vehicle={vehicle} />
        </div>
        <input type="hidden" name="description" value={description} />
        <div hidden={!visible.includes("itens")} style={{ order: 1 }}>
          <LegendSection form={form} />
        </div>
        {mode === "create" ? (
          <div hidden={!visible.includes("operacao")} style={{ order: 0 }}>
            <OperationSection form={form} />
          </div>
        ) : null}
      </div>
      <VehicleWizardNav
        step={step}
        errorSteps={([1, 2, 3, 4] as const).filter((candidate) =>
          Object.keys(errors).some(
            (field) => stepForField(field) === candidate,
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
