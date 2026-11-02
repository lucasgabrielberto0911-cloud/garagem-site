import { FipePriceLine, type FipeForm } from "../FipeFields";
import { WizardSection } from "../WizardSection";
import { Field, btn, inputClass } from "@/components/admin/ui";
import { errorBorder } from "../types";
import type { VehicleFormModel } from "../useVehicleFormState";
import { toast } from "sonner";
import { moneyInput, parseMoneyBR } from "@/lib/admin-money";
import { STATUSES } from "../types";

export function PriceStatusSection({
  form,
}: {
  form: FipeForm & Pick<
    VehicleFormModel,
    | "values"
    | "setValues"
    | "status"
    | "setStatus"
    | "errors"
    | "alreadySold"
    | "priceMismatch"
    | "priceSaveBlocked"
    | "revealSections"
    | "sectionProps"
  >;
}) {
  const {
    values,
    setValues,
    status,
    setStatus,
    errors,
    alreadySold,
    priceMismatch,
    priceSaveBlocked,
    revealSections,
    sectionProps,
  } = form;
  return (
    <WizardSection {...sectionProps("essencial")}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4">
        <Field label="Preço (R$)" required error={errors.price}>
          <input
            name="priceDisplay"
            inputMode="decimal"
            value={values.price}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                price: event.target.value,
              }))
            }
            onBlur={() => {
              const amount = parseMoneyBR(values.price);
              if (amount != null)
                setValues((current) => ({
                  ...current,
                  price: moneyInput(amount),
                }));
            }}
            placeholder="0"
            className={`${inputClass} font-display text-lg font-semibold ${errors.price ? errorBorder : ""}`}
          />
        </Field>
        <Field label="Status" error={errors.status}>
          <select
            name="status"
            value={status}
            onChange={(event) => {
              if (event.target.value === "vendido" && !alreadySold) {
                toast.message(
                  "Para vender, use “Iniciar venda”. O estoque muda ao concluir o contrato.",
                );
                return;
              }
              setStatus(event.target.value);
            }}
            className={inputClass}
          >
            {STATUSES.map((item) => (
              <option
                key={item.value}
                value={item.value}
                disabled={item.value === "vendido" && !alreadySold}
              >
                {item.value === "vendido" && !alreadySold
                  ? "Vendido — use “Iniciar venda”"
                  : item.label}
              </option>
            ))}
          </select>
        </Field>
        <FipePriceLine form={form} />
        <p className="col-span-2 -mt-2 text-xs leading-relaxed text-muted">
          {alreadySold
            ? "Já vendido. Disponível/reservado volta para o estoque ao salvar."
            : "Para vender, use “Iniciar venda”. O estoque muda ao concluir o contrato."}
        </p>

        {priceMismatch ? (
          <div
            role={priceSaveBlocked ? "alert" : "status"}
            className={`col-span-2 flex flex-col gap-2 border px-3 py-2.5 text-sm text-cream sm:flex-row sm:items-center sm:justify-between ${
              priceSaveBlocked
                ? "border-brand/50 bg-brand/10"
                : "border-brand-orange/40 bg-brand-orange/10"
            }`}
          >
            <p className="leading-relaxed">
              {priceSaveBlocked
                ? "O preço do texto da descrição não bate com este preço — não dá para salvar assim."
                : "O preço do texto da descrição é diferente deste preço."}
            </p>
            <button
              type="button"
              onClick={() => revealSections(["itens"])}
              className={`${btn.outline} shrink-0`}
            >
              Ver descrição
            </button>
          </div>
        ) : null}
      </div>
    </WizardSection>
  );
}
