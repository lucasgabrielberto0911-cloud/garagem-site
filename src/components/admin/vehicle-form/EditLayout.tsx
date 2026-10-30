import {
  SECTIONS_BY_STEP,
  type VehicleWizardStep,
} from "@/lib/admin-form-sections";
import { stepForField } from "@/lib/admin-vehicle-form-validate";
import { WIZARD_STEP_LABELS } from "@/components/admin/VehicleWizardNav";
import { IdentitySection } from "./sections/IdentitySection";
import { PriceStatusSection } from "./sections/PriceStatusSection";
import { PhotosSection } from "./sections/PhotosSection";
import { SpecsSection } from "./sections/SpecsSection";
import { LegendSection } from "./sections/LegendSection";
import { VehicleActionsMenu } from "./VehicleActionsMenu";
import type { WizardLayoutProps } from "./CreateWizard";

export const EDIT_STEP_SHORT_LABELS = [
  "Fotos",
  "Dados",
  "Preço",
  "Revisar",
] as const;

export function EditLayout({
  form,
  vehicle,
  mode,
  adminId,
}: WizardLayoutProps) {
  const {
    step,
    description,
    errors,
    saving,
    draftSaving,
    photosUploading,
    changeStep,
  } = form;
  const visible = SECTIONS_BY_STEP[step];
  const errorSteps = ([1, 2, 3, 4] as const).filter((candidate) =>
    Object.keys(errors).some((field) => stepForField(field) === candidate),
  );
  const navDisabled = saving || draftSaving;
  const saveDisabled = saving || photosUploading || draftSaving;

  return (
    <>
      <div className="contents">
        <div hidden={!visible.includes("identificacao")} style={{ order: 0 }}>
          <IdentitySection form={form} />
        </div>
        <div hidden={!visible.includes("essencial")} style={{ order: 0 }}>
          <PriceStatusSection form={form} />
        </div>
      </div>
      <div className="contents">
        <div hidden={!visible.includes("fotos")} style={{ order: 0 }}>
          <PhotosSection form={form} vehicle={vehicle} adminId={adminId} />
        </div>
      </div>
      <div className="contents">
        <div hidden={!visible.includes("ficha")} style={{ order: 0 }}>
          <SpecsSection form={form} vehicle={vehicle} />
        </div>
        <input type="hidden" name="description" value={description} />
        <div hidden={!visible.includes("itens")} style={{ order: 1 }}>
          <LegendSection form={form} />
        </div>
      </div>

      <nav
        aria-label="Etapas do anúncio"
        className="fixed inset-x-0 bottom-admin-nav z-20 border-t border-white/10 bg-asphalt px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom,0px))] font-body text-cream sm:px-6 sm:py-3"
      >
        <div className="mx-auto max-w-4xl space-y-2.5">
          <ol className="grid grid-cols-4 gap-1.5 font-display text-xs sm:gap-2">
            {WIZARD_STEP_LABELS.map((label, index) => {
              const current = (index + 1) as VehicleWizardStep;
              const hasError = errorSteps.includes(current);
              const isActive = step === current;
              return (
                <li
                  key={label}
                  aria-current={isActive ? "step" : undefined}
                >
                  <button
                    type="button"
                    disabled={navDisabled}
                    onClick={() => changeStep(current)}
                    className={`flex min-h-[44px] w-full flex-col justify-start text-left transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 ${
                      hasError
                        ? "text-red-400"
                        : isActive
                          ? "font-semibold text-cream"
                          : "text-muted hover:text-cream"
                    }`}
                  >
                    <div
                      aria-hidden="true"
                      className={`mb-1.5 h-1 w-full transition-colors ${
                        hasError
                          ? "bg-red-400"
                          : isActive
                            ? "bg-brand-gradient"
                            : "bg-white/15 hover:bg-white/30"
                      }`}
                    />
                    <span className="leading-tight">
                      {current}.{" "}
                      <span className="sm:hidden">
                        {EDIT_STEP_SHORT_LABELS[index]}
                      </span>
                      <span className="hidden sm:inline">{label}</span>
                      {hasError ? " (erro)" : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center gap-1.5 font-display sm:gap-3">
            <button
              type="button"
              disabled={navDisabled || step === 1}
              onClick={() => changeStep((step - 1) as VehicleWizardStep)}
              className="min-h-11 shrink-0 border border-white/20 px-2.5 py-2 text-xs text-cream transition hover:border-white/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:px-4 sm:text-sm"
            >
              Voltar
            </button>
            {step < 4 ? (
              <button
                type="button"
                disabled={navDisabled}
                onClick={() => changeStep((step + 1) as VehicleWizardStep)}
                className="min-h-11 shrink-0 border border-white/20 px-2.5 py-2 text-xs text-cream transition hover:border-white/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:px-4 sm:text-sm"
              >
                Próximo
              </button>
            ) : null}
            <button
              type="submit"
              disabled={saveDisabled}
              className="inline-flex min-h-[44px] min-w-0 flex-1 items-center justify-center bg-brand px-2.5 py-2 font-display text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:ml-auto sm:flex-none sm:px-5"
            >
              {saving
                ? "Salvando..."
                : photosUploading || draftSaving
                  ? "Aguarde as fotos..."
                  : "Salvar alterações"}
            </button>
            <VehicleActionsMenu form={form} vehicle={vehicle} mode={mode} />
          </div>
        </div>
      </nav>
    </>
  );
}
