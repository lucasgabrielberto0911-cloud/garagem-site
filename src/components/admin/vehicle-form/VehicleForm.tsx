"use client";

import { toast } from "sonner";
import type { VehicleWizardStep } from "@/lib/admin-form-sections";
import { VehicleDraftToolbar } from "@/components/admin/VehicleDraftToolbar";
import { serializePhotos } from "@/components/admin/VehiclePhotoManager";
import { useVehicleFormState } from "./useVehicleFormState";
import { useVehicleFormDraft } from "./useVehicleFormDraft";
import { VehicleFormSummary } from "./VehicleFormSummary";
import { ReviewStep } from "./ReviewStep";
import { CreateWizard } from "./CreateWizard";
import { EditLayout } from "./EditLayout";
import type { VehicleFormProps } from "./types";

export function VehicleForm(props: VehicleFormProps) {
  const { vehicle, preparationId, mode, adminId, listingScore } = props;
  const form = useVehicleFormState(props);
  const draft = useVehicleFormDraft(form, props);
  const {
    step,
    photos,
    accessories,
    values,
    category,
    locationCity,
    state,
    saving,
    draftSaving,
    photosUploading,
    priceSaveBlocked,
    priceMismatch,
    setDirty,
    setErrors,
    validate,
    changeStep,
    revealSections,
    startTransition,
    formAction,
  } = form;
  const Layout = mode === "edit" ? EditLayout : CreateWizard;
  return (
    <>
      <VehicleFormSummary form={form} listingScore={listingScore} />
      <VehicleDraftToolbar {...draft} />
      <form
        id="vehicle-form"
        noValidate
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => {
          setDirty(true);
          const target = event.target;
          if (!(
            target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement ||
            target instanceof HTMLTextAreaElement
          ))
            return;
          const name = target.name;
          const field =
            name === "priceDisplay"
              ? "price"
              : name === "kmDisplay"
                ? "km"
                : name;
          setErrors((current) => {
            const next = { ...current };
            delete next[field];
            return next;
          });
        }}
        onSubmit={(event) => {
          // Dispara a action na mão: com <form action>, o React 19 reseta o
          // form ao terminar e o select de status volta a mostrar o valor
          // antigo — o próximo "Salvar" regravaria o status errado.
          event.preventDefault();
          if (saving || draftSaving) return;
          if (mode === "create" && step !== 4) {
            if (validate(step)) changeStep((step + 1) as VehicleWizardStep);
            return;
          }
          if (!validate()) {
            toast.error("Corrija os campos destacados.");
            return;
          }
          if (photosUploading) {
            toast.error("Espere o envio ou o borrão das fotos terminar.");
            revealSections(["fotos"]);
            return;
          }
          if (priceSaveBlocked) {
            toast.error(
              priceMismatch?.blockMessage ??
                "Corrija a descrição ou o preço antes de salvar.",
            );
            revealSections(["itens"]);
            return;
          }
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="vehicle-form space-y-4 font-body"
      >
        <fieldset disabled={saving} className="flex min-w-0 flex-col gap-4">
          <ReviewStep form={form} vehicle={vehicle} mode={mode} />
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={state.updatedAt ?? vehicle?.updatedAt.toISOString() ?? ""}
          />
          {preparationId ? (
            <input type="hidden" name="preparationId" value={preparationId} />
          ) : null}
          <input
            type="hidden"
            name="photoUrls"
            value={serializePhotos(photos)}
          />
          <input
            type="hidden"
            name="accessories"
            value={JSON.stringify(accessories)}
          />
          <input type="hidden" name="price" value={values.price} />
          <input type="hidden" name="km" value={values.km} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="locationCity" value={locationCity} />

          <Layout form={form} vehicle={vehicle} mode={mode} adminId={adminId} />
        </fieldset>
      </form>
    </>
  );
}
