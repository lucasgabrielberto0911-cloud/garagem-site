import { WizardSection } from "../WizardSection";
import type { VehicleFormModel } from "../useVehicleFormState";
import type { VehicleFormProps } from "../types";
import { VehiclePhotoManager } from "@/components/admin/VehiclePhotoManager";

export function PhotosSection({
  form,
  vehicle,
  adminId,
}: {
  form: Pick<
    VehicleFormModel,
    | "photos"
    | "changePhotos"
    | "setPhotosUploading"
    | "draftScope"
    | "brand"
    | "model"
    | "yearModel"
    | "sectionProps"
  >;
  vehicle?: VehicleFormProps["vehicle"];
  adminId: string;
}) {
  const {
    photos,
    changePhotos,
    setPhotosUploading,
    draftScope,
    brand,
    model,
    yearModel,
    sectionProps,
  } = form;
  return (
    <WizardSection
      {...sectionProps("fotos")}
      title={`Fotos e vídeo${photos.length > 0 ? ` (${photos.length})` : ""}`}

      action={
        photos.length > 0 ? (
          <span className="text-xs text-muted">
            Arraste para reordenar · 1ª = capa
          </span>
        ) : null
      }
    >
      <VehiclePhotoManager
        queueKey={`${adminId}:${draftScope}`}
        photos={photos}
        onChange={changePhotos}
        onUploadingChange={setPhotosUploading}
        listing={{
          brand,
          model,
          year: Number(yearModel) || new Date().getFullYear(),
        }}
      />
      <label className="mt-4 flex min-h-[44px] cursor-pointer items-center gap-2.5 border border-white/10 bg-ink px-3 py-2.5 text-sm text-cream transition touch-manipulation hover:border-brand/50">
        <input
          type="checkbox"
          name="hasVideo"
          defaultChecked={vehicle?.hasVideo ?? false}
          className="h-5 w-5 accent-brand"
        />
        Já temos vídeo deste veículo
      </label>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Não publica o vídeo no site. O visitante continua pedindo pelo WhatsApp.
        A marcação fica só neste cadastro.
      </p>
    </WizardSection>
  );
}
