import { WizardSection } from "../WizardSection";
import type { VehicleFormModel } from "../useVehicleFormState";
import { LegendPasteField } from "@/components/admin/LegendPasteField";
import { legendAccessoriesError } from "@/lib/legend-parser";

export function LegendSection({
  form,
}: {
  form: Pick<
    VehicleFormModel,
    | "errors"
    | "accessories"
    | "priceMismatch"
    | "priceSaveBlocked"
    | "legendRevision"
    | "description"
    | "values"
    | "year"
    | "yearModel"
    | "color"
    | "transmission"
    | "fuel"
    | "engine"
    | "applyLegend"
    | "setDescription"
    | "setDirty"
    | "setAccessories"
    | "changeLegendField"
    | "sectionProps"
  >;
}) {
  const {
    errors,
    accessories,
    priceMismatch,
    priceSaveBlocked,
    legendRevision,
    description,
    values,
    year,
    yearModel,
    color,
    transmission,
    fuel,
    engine,
    applyLegend,
    setDescription,
    setDirty,
    setAccessories,
    changeLegendField,
    sectionProps,
  } = form;
  return (
    <WizardSection {...sectionProps("itens")} title="Legenda do anúncio">
      {errors.accessories || legendAccessoriesError(accessories) ? (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {errors.accessories || legendAccessoriesError(accessories)}
        </p>
      ) : null}
      {priceMismatch || errors.description ? (
        <p
          role="alert"
          data-testid="description-price-mismatch"
          className="mb-3 text-sm text-red-400"
        >
          {priceSaveBlocked ? "Não dá para salvar assim. " : ""}
          {errors.description || priceMismatch?.blockMessage}
        </p>
      ) : null}
      <LegendPasteField
        key={legendRevision}
        description={description}
        accessories={accessories}
        data={{ ...values, year, yearModel, color, transmission, fuel, engine }}
        onChange={applyLegend}
        onRemoveDescription={() => {
          setDescription("");
          setDirty(true);
        }}
        onRemoveItem={(item) =>
          setAccessories((current) => current.filter((entry) => entry !== item))
        }
        onFieldChange={changeLegendField}
      />
    </WizardSection>
  );
}
