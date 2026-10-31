import { WizardSection } from "../WizardSection";
import { Field, inputClass } from "@/components/admin/ui";
import { errorBorder } from "../types";
import type { VehicleFormModel } from "../useVehicleFormState";
import type { VehicleFormProps } from "../types";
import { parseVehicleKm } from "@/lib/admin-vehicle-fields";
import { kmHint } from "@/lib/admin-vehicle-validate";

export function SpecsSection({
  form,
  vehicle,
  collapseAdvanced = false,
}: {
  collapseAdvanced?: boolean;
  form: Pick<
    VehicleFormModel,
    | "year"
    | "setYear"
    | "yearModel"
    | "setYearModel"
    | "values"
    | "setValues"
    | "errors"
    | "fuel"
    | "setFuel"
    | "transmission"
    | "setTransmission"
    | "engine"
    | "setEngine"
    | "plateEnd"
    | "isMoto"
    | "fuelOptions"
    | "transmissionOptions"
    | "transmissionAlert"
    | "transmissionSuggestion"
    | "canFixTransmission"
    | "sectionProps"
  >;
  vehicle?: VehicleFormProps["vehicle"];
}) {
  const {
    year,
    setYear,
    yearModel,
    setYearModel,
    values,
    setValues,
    errors,
    fuel,
    setFuel,
    transmission,
    setTransmission,
    engine,
    setEngine,
    plateEnd,
    isMoto,
    fuelOptions,
    transmissionOptions,
    transmissionAlert,
    transmissionSuggestion,
    canFixTransmission,
    sectionProps,
  } = form;
  const engineAndDoors = (
    <>
      <Field
        label={isMoto ? "Motor / cilindrada" : "Motor"}
        hint={isMoto ? "Ex.: 500cc" : "Ex.: 1.0 TSI"}
      >
        <input
          name="engine"
          value={engine}
          onChange={(event) => setEngine(event.target.value)}
          placeholder={isMoto ? "Ex.: 500cc" : "Ex.: 2.0 Flex"}
          className={inputClass}
        />
      </Field>
      {!isMoto ? (
        <Field label="Portas" error={errors.doors}>
          <input
            name="doors"
            type="number"
            inputMode="numeric"
            min={0}
            max={6}
            defaultValue={vehicle?.doors ?? ""}
            placeholder="Ex.: 4"
            className={`${inputClass} ${errors.doors ? errorBorder : ""}`}
          />
        </Field>
      ) : (
        <input type="hidden" name="doors" value="" />
      )}
    </>
  );
  const origin = (
    <>
      <h3 className="mb-3 mt-6 border-t border-white/10 pt-5 font-display text-xs font-semibold uppercase tracking-wider text-muted">
        Procedência e garantia
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="Final da placa"
          hint="Calculado a partir da placa interna — visível no site"
        >
          <input
            name="plateEnd"
            value={plateEnd}
            readOnly
            placeholder="Preencha a placa"
            className={inputClass}
          />
        </Field>
        <Field
          label="Garantia"
          hint="A loja já anuncia 3 meses (motor e câmbio) no site. Preencha só se este carro for diferente."
        >
          <input
            name="warranty"
            defaultValue={vehicle?.warranty ?? ""}
            placeholder="Ex.: 3 meses — motor e câmbio"
            className={inputClass}
          />
        </Field>
        <Field
          label="Vistoria da loja"
          hint="Se preenchido, a ficha mostra a checagem interna da loja. Não é documento oficial."
          className="sm:col-span-2 lg:col-span-1"
        >
          <input
            name="inspection"
            defaultValue={vehicle?.inspection ?? ""}
            placeholder="Ex.: Concluída"
            className={inputClass}
          />
        </Field>
      </div>
    </>
  );
  return (
    <WizardSection {...sectionProps("ficha")}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Ano de fabricação" required error={errors.year}>
          <input
            name="year"
            type="text"
            inputMode="numeric"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            maxLength={4}
            className={`${inputClass} ${errors.year ? errorBorder : ""}`}
          />
        </Field>
        <Field
          label="Ano modelo"
          required
          error={errors.yearModel}
          hint={
            year && !yearModel ? (
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() => setYearModel(year)}
              >
                Mesmo ano ({year})
              </button>
            ) : undefined
          }
        >
          <input
            name="yearModel"
            type="text"
            inputMode="numeric"
            value={yearModel}
            onChange={(event) => setYearModel(event.target.value)}
            maxLength={4}
            className={`${inputClass} ${errors.yearModel ? errorBorder : ""}`}
          />
        </Field>
        <Field
          label="Quilometragem"
          required
          error={errors.km}
          hint={kmHint(parseVehicleKm(values.km)) ?? undefined}
        >
          <input
            name="kmDisplay"
            inputMode="numeric"
            value={values.km}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                km: event.target.value,
              }))
            }
            placeholder="0"
            className={`${inputClass} ${errors.km ? errorBorder : ""}`}
          />
        </Field>
        <Field label="Combustível" error={errors.fuel}>
          <select
            name="fuel"
            value={fuel}
            onChange={(event) => setFuel(event.target.value)}
            className={inputClass}
            required
          >
            <option value="">Selecione o combustível</option>
            {fuel && !fuelOptions.includes(fuel) ? (
              <option value={fuel}>{fuel}</option>
            ) : null}
            {fuelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={isMoto ? "Câmbio / transmissão" : "Câmbio"}
          required
          error={errors.transmission}
        >
          <select
            name="transmission"
            value={transmission}
            onChange={(event) => setTransmission(event.target.value)}
            className={inputClass}
            required
          >
            <option value="">Selecione o câmbio</option>
            {transmission && !transmissionOptions.includes(transmission) ? (
              <option value={transmission}>{transmission}</option>
            ) : null}
            {transmissionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {transmissionAlert ? (
            <p className="mt-2 text-xs leading-relaxed text-brand-orange">
              {transmissionAlert}. O site público mostra{" "}
              {transmissionSuggestion}.
              {canFixTransmission ? (
                <>
                  {" "}
                  <button
                    type="button"
                    className="underline underline-offset-2"
                    onClick={() => setTransmission(transmissionSuggestion)}
                  >
                    Corrigir câmbio
                  </button>
                </>
              ) : null}
            </p>
          ) : null}
        </Field>
        {collapseAdvanced ? null : engineAndDoors}
      </div>

      {collapseAdvanced ? (
        <details className="mt-4 border-t border-white/10 pt-3">
          <summary className="min-h-11 cursor-pointer touch-manipulation py-2 font-display text-xs font-semibold uppercase tracking-wider text-muted">
            Mais detalhes (opcional)
            <span className="ml-2 font-body normal-case tracking-normal">
              Motor, portas, garantia, vistoria
            </span>
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {engineAndDoors}
          </div>
          {origin}
        </details>
      ) : (
        origin
      )}
    </WizardSection>
  );
}
