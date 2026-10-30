import {
  SECTIONS_BY_STEP,
  sectionForField,
  type VehicleWizardStep,
} from "./admin-form-sections";
import { parseVehicleFormFields } from "./admin-vehicle-fields";
import {
  descriptionPriceMismatch,
  descriptionPriceMismatchBlocksSave,
  validateVehicleListing,
} from "./admin-vehicle-validate";
import { legendAccessoriesError } from "./legend-parser";

export function stepForField(field: string): VehicleWizardStep | undefined {
  if (field === "photos") return 1;
  if (field === "locationCity" || field === "featured") return 4;
  const section = sectionForField(field);
  return ([1, 2, 3, 4] as const).find(
    (candidate) =>
      section != null && SECTIONS_BY_STEP[candidate].includes(section),
  );
}

/** Valida os dados do wizard sem acessar DOM nem alterar o estado do formulário. */
export function validateVehicleForm(
  data: Pick<FormData, "get">,
  options: {
    mode: "create" | "edit";
    status: string;
    fuel: string;
    transmission: string;
    color: string;
    locationCity: string;
    accessories: string[];
    photoCount: number;
    photosUploading: boolean;
    onlyStep?: VehicleWizardStep;
    invalidFields?: Record<string, string>;
  },
): Record<string, string> {
  const value = (name: string) => String(data.get(name) ?? "");
  const parsed = parseVehicleFormFields(data);
  const next = { ...parsed.fieldErrors };
  const legendError = legendAccessoriesError(options.accessories);
  if (legendError) next.accessories = legendError;

  const listingIssues = validateVehicleListing({
    brand: value("brand").trim(),
    model: value("model").trim(),
    fuel: options.fuel,
    transmission: options.transmission,
    color: value("color").trim() || options.color,
    km: parsed.km,
    price: parsed.price,
    locationCity: value("locationCity").trim() || options.locationCity,
  });
  for (const issue of listingIssues) {
    if (issue.field !== "form" && !next[issue.field])
      next[issue.field] = issue.message;
  }

  const mismatch = descriptionPriceMismatch(
    value("description"),
    parsed.price ?? 0,
  );
  if (mismatch && descriptionPriceMismatchBlocksSave(options.status)) {
    next.description = mismatch.blockMessage;
  }

  for (const [field, message] of Object.entries(options.invalidFields ?? {})) {
    if (sectionForField(field) && !next[field])
      next[field] = message || "Valor inválido.";
  }

  if (options.photosUploading || options.photoCount === 0)
    next.photos = options.photosUploading
      ? "Espere o envio ou o borrão das fotos terminar."
      : "Adicione pelo menos uma foto.";
  if (options.mode === "create" && options.status === "reservado")
    next.status = "Cadastre como disponível antes de reservar o veículo.";
  if (options.mode === "create" && options.status === "vendido")
    next.status = "Cadastre como disponível antes de iniciar a venda.";

  if (options.onlyStep === 2) {
    for (const field of [
      "color",
      "year",
      "yearModel",
      "km",
      "fuel",
      "transmission",
      "engine",
    ]) {
      if (!value(field === "km" ? "kmDisplay" : field).trim())
        delete next[field];
    }
  }
  if (options.onlyStep) {
    for (const field of Object.keys(next)) {
      if (stepForField(field) !== options.onlyStep) delete next[field];
    }
  }
  return next;
}
