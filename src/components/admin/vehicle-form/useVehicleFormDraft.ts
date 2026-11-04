import {
  photosFromRecords,
  reconcileDraftPhotos,
  type PhotoItem,
} from "@/components/admin/VehiclePhotoManager";
import type { VehicleDraftPayload } from "@/components/admin/VehicleDraftToolbar";
import { parseVehicleCategory } from "@/lib/vehicle-accessories";
import { parseVehicleLocationCity } from "@/lib/vehicle-location";
import type { VehicleFormModel } from "./useVehicleFormState";
import type { VehicleFormProps } from "./types";

export function useVehicleFormDraft(
  form: VehicleFormModel,
  { vehicle, adminId, autoRestoreDraft }: VehicleFormProps,
) {
  const {
    step,
    setStep,
    photos,
    setPhotos,
    draftScope,
    setDraftSaving,
    dirty,
    setDirty,
    state,
    saving,
    accessories,
    setAccessoriesState,
    consigned,
    setConsigned,
    category,
    setCategory,
    locationCity,
    setLocationCity,
    fuel,
    setFuel,
    transmission,
    setTransmission,
    setErrors,
    values,
    setValues,
    brand,
    setBrand,
    model,
    setModel,
    version,
    setVersion,
    color,
    setColor,
    year,
    setYear,
    yearModel,
    setYearModel,
    plate,
    setPlate,
    plateEnd,
    engine,
    setEngine,
    purchase,
    setPurchase,
    description,
    setDescription,
    status,
    setStatus,
    autoLegendData,
    setLegendRevision,
    photosUploading,
  } = form;
  function snapshot() {
    const form = document.getElementById("vehicle-form") as HTMLFormElement;
    return {
      step,
      fields: Object.fromEntries(new FormData(form)),
      photos,
      brand,
      model,
      version,
      color,
      year,
      yearModel,
      plate,
      plateEnd,
      engine,
      purchase,
      description,
      status,
      values,
      category,
      locationCity,
      fuel,
      transmission,
      accessories,
      consigned,
    };
  }
  function restore(draft: VehicleDraftPayload) {
    const savedStep = draft.step;
    setStep(
      savedStep === 2 || savedStep === 3 || savedStep === 4 ? savedStep : 1,
    );
    const text = (key: string) =>
      typeof draft[key] === "string" ? (draft[key] as string) : "";
    setBrand(text("brand"));
    setModel(text("model"));
    setVersion(text("version"));
    setColor(text("color"));
    setYear(text("year"));
    setYearModel(text("yearModel"));
    setPlate(text("plate"));
    setEngine(text("engine"));
    setPurchase(text("purchase"));
    setDescription(text("description"));
    setLegendRevision((current) => current + 1);
    autoLegendData.current = {};
    setStatus(
      ["disponivel", "reservado", "vendido"].includes(text("status"))
        ? text("status")
        : "disponivel",
    );
    setCategory(parseVehicleCategory(text("category")));
    setLocationCity(parseVehicleLocationCity(text("locationCity")) ?? "");
    setFuel(text("fuel"));
    setTransmission(text("transmission"));
    setConsigned(Boolean(draft.consigned));
    if (draft.values && typeof draft.values === "object")
      setValues(draft.values as typeof values);
    if (Array.isArray(draft.photos))
      setPhotos(
        reconcileDraftPhotos(
          (draft.photos as Array<Partial<PhotoItem>>).filter(
            (photo): photo is Partial<PhotoItem> & { url: string } =>
              typeof photo?.url === "string",
          ),
          vehicle
            ? photosFromRecords(
                vehicle.photos.slice().sort((a, b) => a.order - b.order),
              )
            : [],
        ),
      );
    if (Array.isArray(draft.accessories))
      setAccessoriesState(
        draft.accessories.filter(
          (item): item is string => typeof item === "string",
        ),
      );
    const fields = draft.fields as Record<string, string> | undefined;
    if (fields)
      requestAnimationFrame(() => {
        const form = document.getElementById("vehicle-form") as HTMLFormElement;
        for (const key of [
          "doors",
          "warranty",
          "inspection",
          "featured",
          "hasVideo",
          "inStoreName",
          "hasSpareKey",
          "hasManual",
        ]) {
          const element = form.elements.namedItem(key);
          if (
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement
          ) {
            if (
              element instanceof HTMLInputElement &&
              element.type === "checkbox"
            )
              element.checked = fields[key] === "on";
            else element.value = fields[key] || "";
          }
        }
      });
    setDirty(true);
    setErrors({});
  }

  return {
    draftKey: `vehicle:${draftScope}`,
    storageKey: `garagem:vehicle-draft:${adminId}:${draftScope}`,
    enabled: dirty && !saving && !state.success,
    published: Boolean(state.success),
    disabled: saving || photosUploading,
    onSavingChange: setDraftSaving,
    snapshot,
    restore,
    autoRestore: Boolean(autoRestoreDraft),
  };
}
