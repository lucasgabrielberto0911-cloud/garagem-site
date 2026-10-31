"use client";

import type { ReactNode } from "react";
import type { VehicleWizardStep } from "@/lib/admin-form-sections";

export const WIZARD_STEP_LABELS = [
  "Fotos",
  "Dados do veículo",
  "Preço e anúncio",
  "Revisar e publicar",
] as const;

export const WIZARD_STEP_SHORT_LABELS = [
  "Fotos",
  "Dados",
  "Preço",
  "Revisar",
] as const;

export function VehicleWizardNav({ step, errorSteps, disabled, onBack, onNext, children }: {
  step: VehicleWizardStep;
  errorSteps: VehicleWizardStep[];
  disabled: boolean;
  onBack: () => void;
  onNext: () => void;
  children: ReactNode;
}) {
  return (
    <nav aria-label="Etapas do anúncio" className="fixed inset-x-0 bottom-admin-nav z-20 border-t border-white/10 bg-asphalt px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] font-body text-cream sm:px-6">
      <div className="mx-auto max-w-4xl space-y-3">
        <ol className="grid grid-cols-4 gap-2 font-display text-xs">
          {WIZARD_STEP_LABELS.map((label, index) => {
            const current = (index + 1) as VehicleWizardStep;
            const hasError = errorSteps.includes(current);
            return (
              <li key={label} aria-current={step === current ? "step" : undefined} className={hasError ? "text-red-400" : step >= current ? "text-cream" : "text-muted"}>
                <div aria-hidden="true" className={`mb-2 h-1 ${step >= current ? "bg-brand-gradient" : "bg-white/15"}`} />
                <span>
                  {current}. <span className="sm:hidden">{WIZARD_STEP_SHORT_LABELS[index]}</span><span className="hidden sm:inline">{label}</span>{hasError ? " (erro)" : ""}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="flex items-center justify-between gap-3 font-display">
          <button
            type="button"
            disabled={disabled || step === 1}
            onClick={onBack}
            className="min-h-11 border border-white/20 px-5 py-2 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            Voltar
          </button>
          {step === 4 ? (
            <div className="flex min-h-11 items-center">{children}</div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={onNext}
              className="min-h-11 bg-brand px-5 py-2 text-sm font-semibold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Próximo
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
