import { FipeDataLink, type FipeForm } from "../FipeFields";
import { WizardSection } from "../WizardSection";
import { Field, inputClass } from "@/components/admin/ui";
import { errorBorder } from "../types";
import type { VehicleFormModel } from "../useVehicleFormState";
import { VEHICLE_CATEGORIES } from "@/lib/vehicle-accessories";
import { formatPlateInput } from "@/lib/format";
import { SEGMENT, SEGMENT_ON, SEGMENT_OFF } from "../types";

export function IdentitySection({
  form,
}: {
  form: FipeForm & Pick<
    VehicleFormModel,
    | "category"
    | "isMoto"
    | "changeCategory"
    | "plate"
    | "handlePlateChange"
    | "errors"
    | "brand"
    | "setBrand"
    | "model"
    | "setModel"
    | "version"
    | "setVersion"
    | "color"
    | "setColor"
    | "sectionProps"
  >;
}) {
  const {
    category,
    isMoto,
    changeCategory,
    plate,
    handlePlateChange,
    errors,
    brand,
    setBrand,
    model,
    setModel,
    version,
    setVersion,
    color,
    setColor,
    sectionProps,
  } = form;
  return (
    <WizardSection {...sectionProps("identificacao")}>
      <div className="mb-5">
        <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted">
          Tipo do anúncio
        </span>
        <div className="flex gap-2" role="group" aria-label="Tipo do anúncio">
          {VEHICLE_CATEGORIES.map((option) => {
            const selected = category === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => changeCategory(option.value)}
                title={
                  option.value === "moto"
                    ? "Checklist e opções de moto (ABS, bauleto, painel digital…)."
                    : "Checklist e opções de carro (multimídia, ar, bancos…)."
                }
                className={`${SEGMENT} ${selected ? SEGMENT_ON : SEGMENT_OFF}`}
              >
                <span className="font-display text-sm font-semibold uppercase tracking-wide">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <Field
        label="Placa (interna)"
        error={errors.plate}
        hint="Só no admin. O site mostra no máximo o final da placa."
      >
        <input
          name="plate"
          value={plate}
          aria-invalid={Boolean(errors.plate)}
          onChange={(event) =>
            handlePlateChange(formatPlateInput(event.target.value))
          }
          placeholder="ABC1D23 ou ABC-1234"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Marca" required error={errors.brand}>
          <input
            name="brand"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            placeholder={isMoto ? "Ex.: Honda" : "Ex.: Volkswagen"}
            className={`${inputClass} ${errors.brand ? errorBorder : ""}`}
          />
        </Field>
        <div>
          <Field label="Modelo" required error={errors.model}>
            <input
              name="model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={isMoto ? "Ex.: CB 500F" : "Ex.: Golf"}
              className={`${inputClass} ${errors.model ? errorBorder : ""}`}
            />
          </Field>
          <FipeDataLink form={form} />
        </div>
        <Field label={isMoto ? "Versão / cilindrada" : "Versão"}>
          <input
            name="version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder={isMoto ? "Ex.: ABS 2023" : "Ex.: GTI 2.0 TSI"}
            className={inputClass}
          />
        </Field>
        <Field
          label="Cor"
          required
          error={errors.color}
          hint="Fica vazia no anúncio se faltar."
        >
          <input
            name="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            placeholder="Ex.: Prata"
            className={`${inputClass} ${errors.color ? errorBorder : ""}`}
          />
        </Field>
      </div>
    </WizardSection>
  );
}
