"use client";

import { useActionState, useEffect, useRef } from "react";
import { btn, inputClass } from "@/components/admin/ui";
import { localDateInput } from "@/lib/admin-date";
import { moneyInput } from "@/lib/admin-money";
import { checkedFieldValue } from "@/lib/preparation-form-fields";
import { savePreparationAction, type PreparationActionState } from "./actions";

type PreparationItem = {
  id: string;
  brand: string;
  model: string;
  color: string | null;
  year: number | null;
  km: number | null;
  plate: string | null;
  ready: boolean;
  posted: boolean;
  purchasedAt: Date | null;
  purchasePrice: number | null;
};

export function PreparationForm({
  item,
  onSuccess,
}: {
  item?: PreparationItem;
  onSuccess?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    PreparationActionState,
    FormData
  >(savePreparationAction, {});

  const isEditing = Boolean(item);

  useEffect(() => {
    if (state.ok && !isEditing) {
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state.ok, isEditing, onSuccess]);

  const errors = state.errors ?? {};
  const fields = state.fields;

  const getFieldValue = (
    key: string,
    fallback: string | number | null | undefined,
  ) => {
    if (fields && key in fields) return fields[key] ?? "";
    return fallback ?? "";
  };

  const getCheckedValue = (key: string, fallback?: boolean) => {
    return checkedFieldValue(fields, key, fallback);
  };

  const inputErrorClass = (hasError?: boolean) =>
    hasError
      ? `${inputClass} border-brand/70 focus:border-brand`
      : inputClass;

  const labelClass = "grid gap-1 text-xs text-muted sm:text-sm";

  return (
    <form ref={formRef} action={formAction} className="space-y-4" noValidate>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      {state.message ? (
        <div
          role={state.ok ? "status" : "alert"}
          className={`border p-3 text-sm ${
            state.ok
              ? "border-white/10 bg-white/5 text-cream"
              : "border-brand/60 bg-brand/10 text-red-300"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>
          <span>Marca <span className="text-brand">*</span></span>
          <input
            name="brand"
            required
            defaultValue={getFieldValue("brand", item?.brand)}
            aria-invalid={Boolean(errors.brand)}
            className={inputErrorClass(Boolean(errors.brand))}
            placeholder="Ex: Toyota"
          />
          {errors.brand ? (
            <span role="alert" className="text-xs text-red-400">
              {errors.brand}
            </span>
          ) : null}
        </label>

        <label className={labelClass}>
          <span>Modelo/Versão <span className="text-brand">*</span></span>
          <input
            name="model"
            required
            defaultValue={getFieldValue("model", item?.model)}
            aria-invalid={Boolean(errors.model)}
            className={inputErrorClass(Boolean(errors.model))}
            placeholder="Ex: Corolla XEi 2.0"
          />
          {errors.model ? (
            <span role="alert" className="text-xs text-red-400">
              {errors.model}
            </span>
          ) : null}
        </label>

        <label className={labelClass}>
          <span>Cor</span>
          <input
            name="color"
            defaultValue={getFieldValue("color", item?.color)}
            className={inputErrorClass(Boolean(errors.color))}
            placeholder="Ex: Prata"
          />
          {errors.color ? (
            <span role="alert" className="text-xs text-red-400">
              {errors.color}
            </span>
          ) : null}
        </label>

        <label className={labelClass}>
          <span>Ano</span>
          <input
            name="year"
            inputMode="numeric"
            defaultValue={getFieldValue("year", item?.year)}
            aria-invalid={Boolean(errors.year)}
            className={inputErrorClass(Boolean(errors.year))}
            placeholder="Ex: 2022"
          />
          {errors.year ? (
            <span role="alert" className="text-xs text-red-400">
              {errors.year}
            </span>
          ) : null}
        </label>

        <label className={labelClass}>
          <span>KM</span>
          <input
            name="km"
            inputMode="numeric"
            defaultValue={getFieldValue("km", item?.km)}
            aria-invalid={Boolean(errors.km)}
            className={inputErrorClass(Boolean(errors.km))}
            placeholder="Ex: 45000"
          />
          {errors.km ? (
            <span role="alert" className="text-xs text-red-400">
              {errors.km}
            </span>
          ) : null}
        </label>

        <label className={labelClass}>
          <span>Placa</span>
          <input
            name="plate"
            autoCapitalize="characters"
            defaultValue={getFieldValue("plate", item?.plate)}
            aria-invalid={Boolean(errors.plate)}
            className={inputErrorClass(Boolean(errors.plate))}
            placeholder="Ex: ABC1D23"
          />
          {errors.plate ? (
            <span role="alert" className="text-xs text-red-400">
              {errors.plate}
            </span>
          ) : null}
        </label>

        <label className={labelClass}>
          <span>Data da compra</span>
          <input
            name="purchasedAt"
            type="date"
            defaultValue={getFieldValue(
              "purchasedAt",
              item?.purchasedAt ? localDateInput(item.purchasedAt) : "",
            )}
            aria-invalid={Boolean(errors.purchasedAt)}
            className={inputErrorClass(Boolean(errors.purchasedAt))}
          />
          {errors.purchasedAt ? (
            <span role="alert" className="text-xs text-red-400">
              {errors.purchasedAt}
            </span>
          ) : null}
        </label>

        <label className={labelClass}>
          <span>Valor de compra</span>
          <input
            name="purchasePrice"
            inputMode="decimal"
            placeholder="R$ 0,00"
            defaultValue={getFieldValue(
              "purchasePrice",
              item?.purchasePrice != null
                ? moneyInput(item.purchasePrice)
                : "",
            )}
            aria-invalid={Boolean(errors.purchasePrice)}
            className={inputErrorClass(Boolean(errors.purchasePrice))}
          />
          {errors.purchasePrice ? (
            <span role="alert" className="text-xs text-red-400">
              {errors.purchasePrice}
            </span>
          ) : null}
        </label>

        <div className="flex min-h-[44px] items-center gap-6 sm:col-span-2">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-cream touch-manipulation">
            <input
              type="checkbox"
              name="ready"
              defaultChecked={getCheckedValue("ready", item?.ready)}
              className="h-4 w-4 accent-brand"
            />
            <span>Pronto</span>
          </label>
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-cream touch-manipulation">
            <input
              type="checkbox"
              name="posted"
              defaultChecked={getCheckedValue("posted", item?.posted)}
              className="h-4 w-4 accent-brand"
            />
            <span>Postado</span>
          </label>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className={btn.primary}
        >
          {isPending
            ? isEditing
              ? "Salvando..."
              : "Cadastrando..."
            : isEditing
              ? "Salvar"
              : "Cadastrar"}
        </button>
      </div>
    </form>
  );
}
