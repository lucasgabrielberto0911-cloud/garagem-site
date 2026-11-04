import { WizardSection } from "../WizardSection";
import { Field, inputClass } from "@/components/admin/ui";
import type { VehicleFormModel } from "../useVehicleFormState";
import { CONSIGNED_NO_COSTS_NOTE } from "@/lib/vehicle-ops";

export function OperationSection({
  form,
}: {
  form: Pick<
    VehicleFormModel,
    "consigned" | "errors" | "purchase" | "setPurchase" | "sectionProps"
  >;
}) {
  const { consigned, errors, purchase, setPurchase, sectionProps } = form;
  return (
    <WizardSection
      {...sectionProps("operacao")}

      action={<span className="text-xs text-muted">Não aparece no site</span>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {consigned ? (
          <p
            className="border border-sky-400/40 bg-sky-400/10 px-3 py-2.5 text-sm leading-relaxed text-cream"
            data-testid="consigned-no-costs-note"
          >
            {CONSIGNED_NO_COSTS_NOTE}
          </p>
        ) : (
          <Field
            label="Preço de compra"
            error={errors.purchasePrice}
            hint="Opcional. Custos extras entram depois, na aba Operação."
          >
            <input
              name="purchasePrice"
              inputMode="decimal"
              value={purchase}
              onChange={(event) => setPurchase(event.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </Field>
        )}
        <div className="grid gap-2 sm:grid-cols-1">
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-cream">
            <input
              type="checkbox"
              name="inStoreName"
              className="h-4 w-4 accent-brand"
            />
            Documento em nome da loja
          </label>
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-cream">
            <input
              type="checkbox"
              name="hasSpareKey"
              className="h-4 w-4 accent-brand"
            />
            Chave reserva
          </label>
          <label className="flex min-h-[44px] items-center gap-2 text-sm text-cream">
            <input
              type="checkbox"
              name="hasManual"
              className="h-4 w-4 accent-brand"
            />
            Manual
          </label>
        </div>
      </div>
    </WizardSection>
  );
}
