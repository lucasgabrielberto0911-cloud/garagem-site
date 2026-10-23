"use client";

import { photoQueueStorage } from "@/lib/admin-photo-queue-store";
import { ListingQualityCard } from "@/components/admin/ListingQualityCard";
import { LegendPasteField } from "@/components/admin/LegendPasteField";
import { legendAccessoriesError, type LegendField, type LegendParseResult } from "@/lib/legend-parser";
import type { StoredListingScore } from "@/lib/listing-score";
import { VehicleWizardNav, WIZARD_STEP_LABELS } from "@/components/admin/VehicleWizardNav";
import { VehicleFormPreview } from "@/components/admin/VehicleFormPreview";
import { parseVehicleFormFields, parseVehicleKm } from "@/lib/admin-vehicle-fields";
import { adminMutation } from "@/lib/admin-mutation";
import { focusAdminError } from "@/lib/admin-form-focus";
import { moneyInput, parseMoneyBR } from "@/lib/admin-money";
import { vehicleDraftScope } from "@/lib/preparation";
import {
  VehicleDraftToolbar,
  type VehicleDraftPayload,
} from "@/components/admin/VehicleDraftToolbar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
} from "react";
import { toast } from "sonner";
import type { Photo, Vehicle } from "@prisma/client";
import {
  createVehicle,
  deleteVehicle,
  updateVehicle,
  type VehicleFormState,
} from "@/app/admin/veiculos/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { VehiclePromoKitModal } from "@/components/admin/VehiclePromoKitModal";
import {
  ActionSheet,
  ActionSheetButton,
  ActionSheetLink,
} from "@/components/admin/ActionSheet";
import { FormSection } from "@/components/admin/FormSection";
import { useUnsavedChangesWarning } from "@/components/admin/useUnsavedChangesWarning";
import {
  IconCash,
  IconExternal,
  IconMore,
  IconStar,
  IconTrash,
} from "@/components/admin/icons";
import { Field, btn, inputClass } from "@/components/admin/ui";
import {
  VehiclePhotoManager,
  photosFromRecords,
  reconcileDraftPhotos,
  serializePhotos,
  type PhotoItem,
} from "@/components/admin/VehiclePhotoManager";
import {
  formatCurrencyBRL,
  formatNumberBR,
  formatPlateDisplay,
  resolvePlateEnd,
  formatPlateInput,
} from "@/lib/format";
import {
  CONSIGNED_HINT,
  CONSIGNED_LABEL,
  CONSIGNED_NO_COSTS_NOTE,
} from "@/lib/vehicle-ops";
import { vehiclePath } from "@/lib/vehicle-slug";
import {
  suggestedTransmission,
  transmissionConflictAlert,
} from "@/lib/vehicle-display";
import {
  VEHICLE_CATEGORIES,
  defaultFuel,
  filterAccessoriesForCategory,
  getFuels,
  getTransmissions,
  normalizeAccessories,
  parseVehicleCategory,
  type VehicleCategory,
} from "@/lib/vehicle-accessories";
import {
  descriptionPriceMismatch,
  descriptionPriceMismatchBlocksSave,
  kmHint,
  validateVehicleListing,
} from "@/lib/admin-vehicle-validate";
import {
  VEHICLE_LOCATION_CITIES,
  VEHICLE_LOCATION_HINT,
  parseVehicleLocationCity,
  type VehicleLocationCity,
} from "@/lib/vehicle-location";
import {
  DELETE_CONFIRM_PHRASE,
  deleteRequiresTypedConfirm,
} from "@/lib/admin-list";
import {
  SECTIONS_BY_STEP,
  type VehicleWizardStep,
  accessoriesSummary,
  descriptionSummary,
  fichaSummary,
  identitySummary,
  initialOpenSections,
  sectionForField,
  sectionsWithErrors,
  vehicleFormSections,
  type VehicleFormSectionId,
} from "@/lib/admin-form-sections";

type VehicleWithPhotos = Vehicle & { photos: Photo[] };

const STATUSES = [
  { value: "disponivel", label: "Disponível" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
];

const initialState: VehicleFormState = {};

const CHIP_SCROLL =
  "flex min-w-0 gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const SEGMENT =
  "flex min-h-[44px] flex-1 flex-col items-center justify-center border px-3 py-2 text-center transition touch-manipulation";
const SEGMENT_ON = "border-brand bg-brand/10 text-cream";
const SEGMENT_OFF =
  "border-white/10 bg-ink text-muted hover:border-white/25 hover:text-cream";

function stepForField(field: string): VehicleWizardStep | undefined {
  if (field === "photos") return 1;
  if (field === "locationCity" || field === "featured") return 4;
  const section = sectionForField(field);
  return ([1, 2, 3, 4] as const).find(candidate =>
    section != null && SECTIONS_BY_STEP[candidate].includes(section));
}

function sectionAnchor(id: VehicleFormSectionId) {
  return `secao-${id}`;
}

function WizardSection({ id, title, action, errorCount = 0, children }: ComponentProps<typeof FormSection>) {
  return (
    <section id={id} className={`scroll-mt-admin-form border bg-ink/50 ${errorCount ? "border-brand/50" : "border-white/10"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-cream">
          {title}
          {errorCount ? <span className="ml-2 text-red-400">{errorCount === 1 ? "1 erro" : `${errorCount} erros`}</span> : null}
        </h3>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function SubmitButton({
  label,
  pending,
  disabled,
  disabledLabel,
}: {
  label: string;
  pending: boolean;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const blocked = pending || disabled;
  return (
    <button
      type="submit"
      disabled={blocked}
      className={`${btn.primary} w-full sm:w-auto`}
    >
      {pending
        ? "Salvando..."
        : disabled
          ? (disabledLabel ?? "Aguarde as fotos...")
          : label}
    </button>
  );
}

export function VehicleForm({
  vehicle,
  mode,
  adminId,
  listingScore = null,
  initialTab = "anuncio",
  layout = "accordion",
  prefill,
  preparationId,
}: {
  vehicle?: VehicleWithPhotos;
  /** Dados de um carro Em preparação para pré-preencher o cadastro novo. */
  prefill?: Partial<VehicleWithPhotos>;
  preparationId?: string;
  mode: "create" | "edit";
  adminId: string;
  /** Nota gravada no último Salvar. O formulário nunca chama o Jev. */
  listingScore?: StoredListingScore | null;
  initialTab?: "anuncio" | "fotos";
  layout?: "accordion" | "wizard";
}) {
  const router = useRouter();
  const isWizard = layout === "wizard";
  const [step, setStep] = useState<VehicleWizardStep>(1);
  const init: Partial<VehicleWithPhotos> | undefined = vehicle ?? prefill;
  const [activeTab, setActiveTab] = useState<"anuncio" | "fotos">(
    initialTab === "fotos" ? "fotos" : "anuncio",
  );
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab === "fotos" ? "fotos" : "anuncio");
    if (isWizard && initialTab === "fotos") setStep(1);
  }, [initialTab, isWizard]);
  const boundUpdate = useMemo(
    () => (vehicle ? updateVehicle.bind(null, vehicle.id) : createVehicle),
    [vehicle],
  );

  const action = (prev: VehicleFormState, data: FormData) =>
    adminMutation(() =>
      (mode === "create" ? createVehicle : boundUpdate)(prev, data),
    );
  const [state, formAction, saving] = useActionState(action, initialState);

  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    photosFromRecords(
      vehicle?.photos
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((photo) => ({
          id: photo.id,
          url: photo.url,
          thumbnailUrl: photo.thumbnailUrl,
        })) ?? [],
    ),
  );
  const [photosUploading, setPhotosUploading] = useState(false);
  const draftScope = vehicleDraftScope(vehicle?.id, preparationId);
  const [draftSaving, setDraftSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);
  useEffect(() => {
    if (!dirty || !photos.length) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch("/api/admin/drafts", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: `vehicle:${draftScope}`,
          reserve: true,
          photoUrls: photos.flatMap((photo) =>
            [photo.url, photo.thumbnailUrl].filter(Boolean),
          ),
        }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("reserve");
        })
        .catch(() => {
          if (!controller.signal.aborted)
            toast.error(
              "Não foi possível proteger as fotos do rascunho. Mantenha esta tela aberta e tente Guardar rascunho.",
            );
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [photos, dirty, draftScope]);
  const changePhotos: typeof setPhotos = (next) => {
    setPhotos(next);
    setDirty(true);
  };
  const [accessories, setAccessoriesState] = useState<string[]>(() =>
    normalizeAccessories(init?.accessories ?? []),
  );
  const setAccessories: typeof setAccessoriesState = (next) => {
    setAccessoriesState(next);
    setDirty(true);
  };
  const [consigned, setConsigned] = useState(init?.consigned ?? false);
  const [category, setCategory] = useState<VehicleCategory>(() =>
    parseVehicleCategory(init?.category),
  );
  const [locationCity, setLocationCity] = useState<VehicleLocationCity | "">(
    () =>
      parseVehicleLocationCity(init?.locationCity) ?? "",
  );
  const [fuel, setFuel] = useState(
    () => init?.fuel ?? (prefill ? "" : defaultFuel(parseVehicleCategory(init?.category))),
  );
   const [transmission, setTransmission] = useState(init?.transmission ?? "");
  const [pendingAction, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSold, setConfirmSold] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(mode === "create");
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (photosUploading || photos.length === 0) return;
    setErrors((current) => {
      if (!current.photos) return current;
      const next = { ...current };
      delete next.photos;
      return next;
    });
  }, [photosUploading, photos.length]);
  const [openSections, setOpenSections] = useState<Set<VehicleFormSectionId>>(
    () =>
      new Set(
        initialOpenSections(mode, {
          quickMode: mode === "create",
          descriptionNeedsAttention: Boolean(
            vehicle?.description &&
            descriptionPriceMismatch(vehicle.description, vehicle.price),
          ),
        }),
      ),
  );

  function toggleSection(id: VehicleFormSectionId) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const revealSections = useCallback((ids: VehicleFormSectionId[], scrollTo = ids[0]) => {
    if (ids.length === 0) return;
    if (isWizard) {
      const target = ([1, 2, 3, 4] as const).find((candidate) =>
        SECTIONS_BY_STEP[candidate].includes(scrollTo),
      );
      if (target) setStep(target);
    }
    setOpenSections((current) => new Set([...current, ...ids]));
    const hasAnuncioTarget = ids.some((id) => id !== "fotos");
    if (hasAnuncioTarget) {
      setActiveTab("anuncio");
    } else if (ids.includes("fotos")) {
      setActiveTab("fotos");
    }
    if (!scrollTo) return;
    requestAnimationFrame(() => {
      document.getElementById(sectionAnchor(scrollTo))?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    });
  }, [isWizard]);

  useEffect(() => {
    if (mode !== "edit") return;
    function onTabClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element | null)?.closest?.(
        'a[data-vehicle-tab="anuncio"], a[data-vehicle-tab="fotos"]',
      );
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const tab = anchor.getAttribute("data-vehicle-tab");
      if (tab !== "anuncio" && tab !== "fotos") return;
      event.preventDefault();
      setActiveTab(tab);
      if (isWizard && tab === "fotos") setStep(1);
      if (tab === "fotos") {
        setOpenSections((current) => new Set([...current, "fotos"]));
      }
      window.history.replaceState(window.history.state, "", anchor.href);
    }
    window.addEventListener("click", onTabClick, true);
    return () => window.removeEventListener("click", onTabClick, true);
  }, [mode, isWizard]);

  useEffect(() => {
    if (mode !== "edit") return;
    for (const tab of ["anuncio", "fotos"] as const) {
      const el = document.querySelector<HTMLAnchorElement>(
        `a[data-vehicle-tab="${tab}"]`,
      );
      if (!el) continue;
      const isActive = activeTab === tab;
      if (isActive) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
      el.classList.toggle("border-brand", isActive);
      el.classList.toggle("text-cream", isActive);
      el.classList.toggle("border-transparent", !isActive);
      el.classList.toggle("text-muted", !isActive);
      el.classList.toggle("hover:text-cream", !isActive);
    }
  }, [mode, activeTab]);

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
      if (state.fieldErrors) {
        setErrors(state.fieldErrors);
        if (state.fieldErrors.locationCity || state.fieldErrors.featured) {
          setMoreOptionsOpen(true);
        }
        revealSections(sectionsWithErrors(state.fieldErrors));
        if (isWizard) {
          const target = ([1, 2, 3, 4] as const).find(candidate =>
            Object.keys(state.fieldErrors ?? {}).some(field => stepForField(field) === candidate));
          if (target) setStep(target);
        }
      }
    }
    if (state.success) {
      setErrors({});
      void photoQueueStorage(`${adminId}:${draftScope}`, null);
      void fetch(`/api/admin/drafts?key=vehicle:${draftScope}`, {
        method: "DELETE",
      });
      // No cadastro, a guarda sai ao desmontar: limpá-la antes pode cancelar o redirecionamento pelo histórico.
      if (!state.id) setDirty(false);
      toast.success("Anúncio salvo com sucesso.");
    }
    if (state.success && state.id) router.push(`/admin/veiculos/${state.id}`);
  }, [state, draftScope, adminId, router, isWizard, revealSections]);

  const [values, setValues] = useState({
    price: init?.price != null ? moneyInput(init.price) : "",
    km: init?.km != null ? formatNumberBR(init.km) : "",
  });
  const [brand, setBrand] = useState(init?.brand ?? "");
  const [model, setModel] = useState(init?.model ?? "");
  const [version, setVersion] = useState(init?.version ?? "");
  const [color, setColor] = useState(init?.color ?? "");
  const [year, setYear] = useState(
    init?.year != null ? String(init.year) : "",
  );
  const [yearModel, setYearModel] = useState(
    init?.yearModel != null ? String(init.yearModel) : "",
  );
  const [plate, setPlate] = useState(
    init?.plate ? formatPlateDisplay(init.plate) : "",
  );
  const plateEnd = resolvePlateEnd(plate, init?.plateEnd);
  const [engine, setEngine] = useState(init?.engine ?? "");
  const [purchase, setPurchase] = useState(
    prefill?.purchasePrice != null ? moneyInput(prefill.purchasePrice) : "",
  );
  const [description, setDescription] = useState(init?.description ?? "");
  const [status, setStatus] = useState(vehicle?.status ?? "disponivel");

  const autoLegendData = useRef<Partial<Record<LegendField, string>>>({});
  const [legendRevision, setLegendRevision] = useState(0);

  function changeLegendField(field: LegendField, value: string) {
    delete autoLegendData.current[field];
    if (field === "price" || field === "km") setValues(current => ({ ...current, [field]: value }));
    else ({ year: setYear, yearModel: setYearModel, color: setColor, transmission: setTransmission, fuel: setFuel, engine: setEngine })[field](value);
    setDirty(true);
  }

  function applyLegend(parsed: LegendParseResult) {
    setDescription(parsed.description);
    setAccessories(parsed.accessories);
    const current = { ...values, year, yearModel, color, transmission, fuel, engine };
    for (const key of Object.keys(current)) {
      const field = key as LegendField;
      if (!current[field].trim() || current[field] === autoLegendData.current[field]) {
        const value = parsed.data[field] ?? "";
        if (parsed.data[field] !== undefined || autoLegendData.current[field] !== undefined) {
          changeLegendField(field, value);
          autoLegendData.current[field] = value;
        }
      }
    }
    setErrors(current => { const next = { ...current }; delete next.accessories; delete next.description; return next; });
    setDirty(true);
  }

  const fuelOptions = getFuels(category);
  const transmissionOptions = getTransmissions(category);
  const isMoto = category === "moto";
  const transmissionAlert = transmissionConflictAlert(version, transmission);
  const transmissionSuggestion = suggestedTransmission(
    version,
    transmission,
    transmissionOptions,
  );
  const canFixTransmission = transmissionOptions.includes(
    transmissionSuggestion,
  );
  const listedPrice = parseMoneyBR(values.price) ?? 0;
  const priceMismatch = descriptionPriceMismatch(description, listedPrice);
  const priceSaveBlocked = Boolean(
    priceMismatch && descriptionPriceMismatchBlocksSave(status),
  );
  const alreadySold = vehicle?.status === "vendido";

  function changeCategory(next: VehicleCategory) {
    if (next === category) return;
    setDirty(true);
    setCategory(next);
    setAccessories((current) => filterAccessoriesForCategory(current, next));
    const nextFuels = getFuels(next);
    const nextTransmissions = getTransmissions(next);
    setFuel((current) =>
      nextFuels.includes(current) ? current : defaultFuel(next),
    );
    setTransmission((current) =>
      nextTransmissions.includes(current) ? current : "",
    );
  }

  function handlePlateChange(next: string) {
    setPlate(next);
  }

  function changeStep(next: VehicleWizardStep) {
    setStep(next);
    setDirty(true);
    requestAnimationFrame(() => document.getElementById("wizard-title")?.focus());
  }

  function validate(onlyStep?: VehicleWizardStep): boolean {
    const next: Record<string, string> = {};
    const form = document.getElementById("vehicle-form") as HTMLFormElement;
    if (!form) return true;

    const value = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";

    const brand = value("brand").trim();
    const model = value("model").trim();
    const parsed = parseVehicleFormFields(new FormData(form));
    const { km, price } = parsed;
    Object.assign(next, parsed.fieldErrors);
    const legendError = legendAccessoriesError(accessories);
    if (legendError) next.accessories = legendError;

    const listingIssues = validateVehicleListing({
      brand,
      model,
      fuel,
      transmission,
      color: value("color").trim() || color,
      km,
      price,
      locationCity: value("locationCity").trim() || locationCity,
    });
    for (const issue of listingIssues) {
      if (issue.field === "form") continue;
      if (!next[issue.field]) next[issue.field] = issue.message;
    }

    const listed = price ?? 0;
    const mismatch = descriptionPriceMismatch(value("description"), listed);
    if (
      mismatch &&
      descriptionPriceMismatchBlocksSave(status)
    ) {
      next.description = mismatch.blockMessage;
    }

    // O form usa noValidate: seção fechada esconde o campo e o navegador não
    // conseguiria focar o balão de erro nativo.
    for (const element of Array.from(form.elements)) {
      const control = element as HTMLInputElement;
      if (!control.name || !control.willValidate || control.validity.valid)
        continue;
      if (!sectionForField(control.name) || next[control.name]) continue;
      next[control.name] = control.validationMessage || "Valor inválido.";
    }

    if (isWizard) {
      if (photosUploading || photos.length === 0)
        next.photos = photosUploading
          ? "Espere o envio ou o borrão das fotos terminar."
          : "Adicione pelo menos uma foto.";
      if (mode === "create" && status === "reservado")
        next.status = "Cadastre como disponível antes de reservar o veículo.";
      if (mode === "create" && status === "vendido")
        next.status = "Cadastre como disponível antes de iniciar a venda.";
      if (onlyStep === 2) {
        for (const field of ["color", "year", "yearModel", "km", "fuel", "transmission", "engine"]) {
          if (!value(field === "km" ? "kmDisplay" : field).trim()) delete next[field];
        }
      }
      if (onlyStep) {
        for (const field of Object.keys(next)) {
          if (stepForField(field) !== onlyStep) delete next[field];
        }
      }
    }

    setErrors((current) => onlyStep
      ? { ...Object.fromEntries(Object.entries(current).filter(([field]) => stepForField(field) !== onlyStep)), ...next }
      : next);
    if (next.locationCity || next.featured) {
      setMoreOptionsOpen(true);
    }
    revealSections(sectionsWithErrors(next));
    const errorStep = isWizard && Object.keys(next).length
      ? ([1, 2, 3, 4] as const).find(candidate =>
          Object.keys(next).some(field => stepForField(field) === candidate))
      : undefined;
    if (errorStep) {
      setStep(errorStep);
    }
    const first = isWizard
      ? Array.from(form.elements)
          .filter(control => !(control instanceof HTMLInputElement && control.type === "hidden"))
          .map(control => (control as HTMLInputElement).name)
          .map(name => name === "priceDisplay" ? "price" : name === "kmDisplay" ? "km" : name)
          .find(field => next[field] && stepForField(field) === errorStep) ?? Object.keys(next).find(field => stepForField(field) === errorStep)
      : Object.keys(next)[0];
    if (first === "locationCity" && isWizard) {
      requestAnimationFrame(() => form.querySelector<HTMLButtonElement>('[aria-label="Onde está o veículo"] button')?.focus());
    } else if (first === "photos" && isWizard) {
      requestAnimationFrame(() => document.getElementById("wizard-title")?.focus());
    } else if (first)
      requestAnimationFrame(() =>
        focusAdminError(
          form,
          first === "description" || first === "accessories"
            ? "vehicle-legend"
            : first === "price"
            ? "priceDisplay"
            : first === "km"
              ? "kmDisplay"
              : first,
        ),
      );
    return Object.keys(next).length === 0;
  }

  function handleDelete() {
    if (!vehicle) return;
    startTransition(async () => {
      try {
        await deleteVehicle(vehicle.id);
        toast.success("Veículo excluído.");
        router.push("/admin/veiculos");
      } catch {
        toast.error("Erro ao excluir o veículo.");
      }
    });
  }

  function handleMarkSold() {
    if (!vehicle) return;
    const targetId = vehicle.id;
    router.push(`/admin/vendas/nova?veiculo=${targetId}`);
  }

  const Section = isWizard ? WizardSection : FormSection;
  const errorBorder = "border-brand/60";
  const sections = vehicleFormSections(mode);
  const errorSections = new Map<VehicleFormSectionId, number>();
  for (const [field, message] of Object.entries(errors)) {
    const section = message ? sectionForField(field) : null;
    if (section)
      errorSections.set(section, (errorSections.get(section) ?? 0) + 1);
  }
  const sectionProps = (id: VehicleFormSectionId) => ({
    id: sectionAnchor(id),
    title: sections.find((section) => section.id === id)?.label ?? id,
    open:
      (mode === "edit" && id === "fotos" && activeTab === "fotos") ||
      isWizard || openSections.has(id),
    onToggle: () => { if (!isWizard) toggleSection(id); },
    errorCount: errorSections.get(id) ?? 0,
    nextLabel:
      mode === "create" && !isWizard
        ? sections[sections.findIndex((section) => section.id === id) + 1]
            ?.label
        : undefined,
    onNext:
      mode === "create" && !isWizard
        ? () => {
            const next =
              sections[sections.findIndex((section) => section.id === id) + 1];
            if (next) {
              setOpenSections(new Set([next.id]));
              revealSections([next.id]);
            }
          }
        : undefined,
  });
  const statusLabel =
    STATUSES.find((item) => item.value === status)?.label ?? status;
  const cityLabel =
    VEHICLE_LOCATION_CITIES.find((option) => option.value === locationCity)
      ?.label ?? "";
  const isEditPhotosTab = !isWizard && mode === "edit" && activeTab === "fotos";

  const internalOptions = (
              <div className="col-span-2 border-t border-white/10 pt-3">
                {isWizard ? <p className="font-display text-xs font-semibold uppercase tracking-wider text-cream">Mais opções</p> : (
                <button
                  type="button"
                  aria-expanded={moreOptionsOpen}
                  aria-controls="vehicle-more-options"
                  onClick={() => setMoreOptionsOpen((current) => !current)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 border border-white/10 bg-ink px-3 py-2 text-left transition touch-manipulation hover:border-white/25"
                >
                  <span className="font-display text-xs font-semibold uppercase tracking-wider text-cream">
                    Mais opções
                  </span>
                  <span className="truncate font-body text-xs text-muted">
                    {[
                      cityLabel || "Cidade",
                      "Destaque",
                      consigned ? CONSIGNED_LABEL : "Consignado",
                    ].join(" · ")}{" "}
                    {moreOptionsOpen ? "▲" : "▼"}
                  </span>
                </button>
                )}

                <div
                  id="vehicle-more-options"
                  className={
                    (isWizard || moreOptionsOpen)
                      ? "mt-4 grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4"
                      : "hidden"
                  }
                >
                  <div className="col-span-2 sm:col-span-1">
                    <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted">
                      Onde está o veículo *
                    </span>
                    <div
                      className="grid grid-cols-2 gap-2"
                      role="group"
                      aria-label="Onde está o veículo"
                    >
                      {VEHICLE_LOCATION_CITIES.map((option) => {
                        const selected = locationCity === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              if (option.value !== locationCity) setDirty(true);
                              setLocationCity(option.value);
                              setErrors((current) => {
                                const next = { ...current };
                                delete next.locationCity;
                                return next;
                              });
                            }}
                            className={`${SEGMENT} ${selected ? SEGMENT_ON : SEGMENT_OFF} ${
                              errors.locationCity ? errorBorder : ""
                            }`}
                          >
                            <span className="font-display text-sm font-semibold uppercase tracking-wide">
                              {option.label}
                            </span>
                            <span className="text-xs uppercase tracking-wider opacity-70">
                              ES
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {!locationCity && !errors.locationCity ? (
                      <p className="mt-1.5 text-xs text-muted">
                        Selecione a cidade onde o veículo está.
                      </p>
                    ) : null}
                    {errors.locationCity ? (
                      <p className="mt-1.5 text-xs text-red-400">
                        {errors.locationCity}
                      </p>
                    ) : (
                      <details className="mt-1.5 text-xs text-muted">
                        <summary className="cursor-pointer py-1 touch-manipulation">
                          Para que serve?
                        </summary>
                        <p className="mt-1 leading-relaxed">
                          {VEHICLE_LOCATION_HINT}
                        </p>
                      </details>
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted">
                      Vitrine
                    </span>
                    <label className="flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 border border-white/10 bg-ink px-3 py-2.5 text-sm text-cream transition touch-manipulation hover:border-brand/50">
                      <input
                        type="checkbox"
                        name="featured"
                        defaultChecked={vehicle?.featured ?? false}
                        className="h-5 w-5 accent-brand"
                      />
                      <IconStar className="h-4 w-4 text-brand-yellow" />
                      Destaque na home
                    </label>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      Até 8 na home, só disponível. A home não escolhe carro
                      sozinha.
                    </p>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted">
                      Interno · não aparece no site
                    </span>
                    <label
                      className={`flex min-h-[44px] w-full cursor-pointer items-center gap-2.5 border px-3 py-2.5 text-sm text-cream transition touch-manipulation hover:border-brand/50 ${
                        consigned
                          ? "border-sky-400/50 bg-sky-400/10"
                          : "border-white/10 bg-ink"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="consigned"
                        checked={consigned}
                        onChange={(event) => setConsigned(event.target.checked)}
                        className="h-5 w-5 accent-brand"
                        data-testid="consigned-checkbox"
                      />
                      {CONSIGNED_LABEL}
                    </label>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      {CONSIGNED_HINT}
                    </p>
                  </div>
                </div>
              </div>
  );

  return (
    <>
      <div className={(isWizard ? step !== 4 : isEditPhotosTab) ? "hidden" : "space-y-4"}>
        <nav
          hidden={isWizard}
          aria-label="Seções do anúncio"
          className="-mx-3 border-b border-white/10 bg-asphalt/95 px-3 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:sticky lg:top-0 lg:z-20 lg:-mx-8 lg:px-8"
        >
          <div className={CHIP_SCROLL}>
            {sections.map((section) => {
              const count = errorSections.get(section.id) ?? 0;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => revealSections([section.id])}
                  className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border px-3 text-xs font-semibold uppercase tracking-wide transition touch-manipulation ${
                    count > 0
                      ? "border-brand/60 text-red-400"
                      : "border-white/10 text-muted hover:text-cream"
                  }`}
                >
                  {section.nav}
                  {count > 0 ? (
                    <span
                      className="h-1.5 w-1.5 bg-brand"
                      aria-label="com erro"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </nav>

        <ListingQualityCard
          draft={{
            brand,
            model,
            version,
            year,
            yearModel,
            km: values.km,
            transmission,
            fuel,
            color,
            price: listedPrice > 0 ? listedPrice : null,
            description,
            accessories,
            photoCount: photos.length,
            status,
            category,
          }}
          coverUrl={photos[0]?.url ?? ""}
          judgment={listingScore?.judgment ?? null}
          scoredAt={listingScore?.scoredAt ?? null}
          dirty={dirty}
          saving={saving}
          onJump={(section) => revealSections([section])}
        />

        <VehicleFormPreview price={alreadySold ? "Vendido" : listedPrice ? formatCurrencyBRL(listedPrice) : "Preço a preencher"}>
          <p className="font-display text-lg font-semibold text-cream">
            {`${brand} ${model}`.trim() || "Seu próximo anúncio"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {[
              version,
              year && yearModel ? `${year}/${yearModel}` : "Ano a preencher",
              values.km ? `${values.km} km` : "KM a preencher",
              transmission,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-2 font-display text-xl font-bold text-red-400">
            {alreadySold ? "Vendido" : listedPrice ? formatCurrencyBRL(listedPrice) : "Preço a preencher"}
          </p>
          <p className="mt-2 text-xs text-muted">
            {photos.length} foto(s) ·{" "}
            {Object.keys(errors).length
              ? "Corrija os campos destacados antes de publicar."
              : "Confira os dados, a capa e o preço antes de salvar."}
          </p>
        </VehicleFormPreview>
      </div>
      <VehicleDraftToolbar
        draftKey={`vehicle:${draftScope}`}
        storageKey={`garagem:vehicle-draft:${adminId}:${draftScope}`}
        enabled={dirty && !saving && !state.success}
        published={Boolean(state.success)}
        disabled={saving || photosUploading}
        onSavingChange={setDraftSaving}
        snapshot={() => {
          const form = document.getElementById(
            "vehicle-form",
          ) as HTMLFormElement;
          return {
            step: isWizard ? step : undefined,
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
        }}
        restore={(draft: VehicleDraftPayload) => {
          if (isWizard) {
            const savedStep = draft.step;
            setStep(savedStep === 2 || savedStep === 3 || savedStep === 4 ? savedStep : 1);
          }
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
          setLegendRevision(current => current + 1);
          autoLegendData.current = {};
          setStatus(
            ["disponivel", "reservado", "vendido"].includes(text("status"))
              ? text("status")
              : "disponivel",
          );
          setCategory(parseVehicleCategory(text("category")));
          setLocationCity(
            parseVehicleLocationCity(text("locationCity")) ?? "",
          );
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
                      vehicle.photos
                        .slice()
                        .sort((a, b) => a.order - b.order),
                    )
                  : [],
              ),
            );
          if (Array.isArray(draft.accessories))
            setAccessoriesState(draft.accessories.filter((item): item is string => typeof item === "string"));
          const fields = draft.fields as Record<string, string> | undefined;
          if (fields)
            requestAnimationFrame(() => {
              const form = document.getElementById(
                "vehicle-form",
              ) as HTMLFormElement;
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
        }}
      />
      <form
        id="vehicle-form"
        noValidate
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(event) => {
          setDirty(true);
          const target = event.target;
          if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
          const name = target.name;
          const field = name === "priceDisplay" ? "price" : name === "kmDisplay" ? "km" : name;
          setErrors((current) => {
            const next = { ...current };
            delete next[field];
            return next;
          });
        }}
        onSubmit={(event) => {
          // Dispara a action na mão: com <form action>, o React 19 reseta o
          // form ao terminar e o select de status volta a mostrar o valor
          // antigo — o próximo "Salvar" regravaria o status errado.
          event.preventDefault();
          if (saving || draftSaving) return;
          if (isWizard && step !== 4) {
            if (validate(step)) changeStep((step + 1) as VehicleWizardStep);
            return;
          }
          if (!validate()) {
            toast.error("Corrija os campos destacados.");
            return;
          }
          if (photosUploading) {
            toast.error("Espere o envio ou o borrão das fotos terminar.");
            revealSections(["fotos"]);
            return;
          }
          if (priceSaveBlocked) {
            toast.error(
              priceMismatch?.blockMessage ??
                "Corrija a descrição ou o preço antes de salvar.",
            );
            revealSections(["itens"]);
            return;
          }
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className={isWizard ? "space-y-4 pb-56 font-body" : "space-y-3 pb-28 sm:space-y-4 lg:pb-0"}
      >
        <fieldset
          disabled={saving}
          className={isWizard ? "flex min-w-0 flex-col gap-4" : "min-w-0 space-y-3 sm:space-y-4"}
        >
          {isWizard ? (
            <div className="space-y-3">
              <h2 id="wizard-title" tabIndex={-1} className="font-display text-lg font-semibold text-cream">
                Etapa {step} de 4: {WIZARD_STEP_LABELS[step - 1]}
              </h2>
              {errors.photos && step === 1 ? <p role="alert" className="text-sm text-red-400">{errors.photos}</p> : null}
              {step === 1 ? <p className="text-sm text-muted">A primeira foto é a capa. Confira e borre placas visíveis antes de publicar.</p> : null}
              <div hidden={step !== 4} className="space-y-3 text-sm text-muted">
                <p>{photos.length} foto(s) · 1ª é a capa</p>
                <p>{identitySummary({ brand, model, version, color, plate })}</p>
                <p>{fichaSummary({ year, yearModel, km: values.km, transmission, fuel })}</p>
                <p>{descriptionSummary(description)}</p>
                <p>{accessoriesSummary(accessories)}</p>
                <p>{alreadySold ? "Vendido" : values.price ? `R$ ${values.price}` : "Sem preço"} · {statusLabel}</p>
                {internalOptions}
              </div>
            </div>
          ) : null}
          <input
            type="hidden"
            name="expectedUpdatedAt"
            value={state.updatedAt ?? vehicle?.updatedAt.toISOString() ?? ""}
          />
          {preparationId ? (
            <input type="hidden" name="preparationId" value={preparationId} />
          ) : null}
          <input
            type="hidden"
            name="photoUrls"
            value={serializePhotos(photos)}
          />
          <input
            type="hidden"
            name="accessories"
            value={JSON.stringify(accessories)}
          />
          <input
            type="hidden"
            name="price"
            value={values.price}
          />
          <input type="hidden" name="km" value={values.km} />
          <input type="hidden" name="category" value={category} />
          <input type="hidden" name="locationCity" value={locationCity} />

          {mode === "create" && !isWizard ? (
            <div className="flex flex-col gap-2 border border-white/10 bg-ink/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-display text-xs font-semibold uppercase tracking-wider text-cream">
                  Modo de preenchimento
                </span>
                <p className="text-xs text-muted">
                  {quickMode
                    ? "Cadastro rápido: preencha só o essencial (marca, modelo, preço, fotos e ficha). Opcionais podem ser completados depois."
                    : "Ficha completa: todas as seções e opcionais abertos para detalhamento."}
                </p>
              </div>
              <div className="flex gap-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    setQuickMode(true);
                    setMoreOptionsOpen(false);
                    setOpenSections(
                      new Set(["identificacao", "essencial", "fotos", "ficha"]),
                    );
                  }}
                  className={`min-h-[38px] px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                    quickMode
                      ? "bg-brand text-cream"
                      : "border border-white/10 bg-asphalt text-muted hover:text-cream"
                  }`}
                >
                  ⚡ Cadastro rápido
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setQuickMode(false);
                    setMoreOptionsOpen(true);
                    setOpenSections(new Set(sections.map((s) => s.id)));
                  }}
                  className={`min-h-[38px] px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-wider transition touch-manipulation ${
                    !quickMode
                      ? "bg-brand text-cream"
                      : "border border-white/10 bg-asphalt text-muted hover:text-cream"
                  }`}
                >
                  Ficha completa
                </button>
              </div>
            </div>
          ) : null}

          <div className={isWizard ? "contents" : isEditPhotosTab ? "hidden" : "space-y-3 sm:space-y-4"}>
          <div hidden={isWizard && !SECTIONS_BY_STEP[step].includes("identificacao")} style={isWizard ? { order: 0 } : undefined}>
          <Section
            {...sectionProps("identificacao")}
            summary={`${isMoto ? "Moto" : "Carro"} · ${identitySummary({
              brand,
              model,
              version,
              color,
              plate,
            })}`}
          >
            <div className="mb-5">
              <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted">
                Tipo do anúncio
              </span>
              <div
                className="flex gap-2"
                role="group"
                aria-label="Tipo do anúncio"
              >
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
              <Field label="Modelo" required error={errors.model}>
                <input
                  name="model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={isMoto ? "Ex.: CB 500F" : "Ex.: Golf"}
                  className={`${inputClass} ${errors.model ? errorBorder : ""}`}
                />
              </Field>
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
          </Section>
          </div>

          <div hidden={isWizard && !SECTIONS_BY_STEP[step].includes("essencial")} style={isWizard ? { order: 2 } : undefined}>
          <Section
            {...sectionProps("essencial")}
            summary={[
              alreadySold ? "Vendido" : values.price ? `R$ ${values.price}` : "Sem preço",
              statusLabel,
              cityLabel,
              consigned ? CONSIGNED_LABEL : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          >
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

              {!isWizard ? internalOptions : null}
            </div>
          </Section>
          </div>
          </div>

          <div className={isWizard ? "contents" : mode === "edit" && !isEditPhotosTab ? "hidden" : undefined}>
          <div hidden={isWizard && !SECTIONS_BY_STEP[step].includes("fotos")} style={isWizard ? { order: 0 } : undefined}>
          <Section
            {...sectionProps("fotos")}
            title={`Fotos e vídeo${photos.length > 0 ? ` (${photos.length})` : ""}`}
            summary={
              photos.length > 0
                ? `${photos.length} foto${photos.length === 1 ? "" : "s"} · 1ª é a capa`
                : "Nenhuma foto ainda"
            }
            action={
              photos.length > 0 ? (
                <span className="text-xs text-muted">
                  Arraste para reordenar · 1ª = capa
                </span>
              ) : null
            }
          >
            <VehiclePhotoManager
              queueKey={`${adminId}:${draftScope}`}
              photos={photos}
              onChange={changePhotos}
              onUploadingChange={setPhotosUploading}
              listing={{
                brand,
                model,
                year: Number(yearModel) || new Date().getFullYear(),
              }}
            />
            <label className="mt-4 flex min-h-[44px] cursor-pointer items-center gap-2.5 border border-white/10 bg-ink px-3 py-2.5 text-sm text-cream transition touch-manipulation hover:border-brand/50">
              <input
                type="checkbox"
                name="hasVideo"
                defaultChecked={vehicle?.hasVideo ?? false}
                className="h-5 w-5 accent-brand"
              />
              Já temos vídeo deste veículo
            </label>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Não publica o vídeo no site. O visitante continua pedindo pelo
              WhatsApp. A marcação fica só neste cadastro.
            </p>
          </Section>
          </div>
          </div>

          <div className={isWizard ? "contents" : isEditPhotosTab ? "hidden" : "space-y-3 sm:space-y-4"}>
          <div hidden={isWizard && !SECTIONS_BY_STEP[step].includes("ficha")} style={isWizard ? { order: 0 } : undefined}>
          <Section
            {...sectionProps("ficha")}
            summary={fichaSummary({
              year,
              yearModel,
              km: values.km,
              transmission,
              fuel,
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Ano de fabricação" required error={errors.year}>
                <input
                  name="year"
                  type="text"
                  inputMode="numeric"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className={`${inputClass} ${errors.year ? errorBorder : ""}`}
                />
              </Field>
              <Field label="Ano modelo" required error={errors.yearModel}>
                <input
                  name="yearModel"
                  type="text"
                  inputMode="numeric"
                  value={yearModel}
                  onChange={(event) => setYearModel(event.target.value)}
                  className={`${inputClass} ${errors.yearModel ? errorBorder : ""}`}
                />
              </Field>
              <Field
                label="Quilometragem"
                required
                error={errors.km}
                hint={
                  kmHint(parseVehicleKm(values.km)) ??
                  undefined
                }
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
                          onClick={() =>
                            setTransmission(transmissionSuggestion)
                          }
                        >
                          Corrigir câmbio
                        </button>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </Field>
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
            </div>

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
          </Section>
          </div>

          <input type="hidden" name="description" value={description} />
          <div hidden={isWizard && !SECTIONS_BY_STEP[step].includes("itens")} style={isWizard ? { order: 1 } : undefined}>
            <Section {...sectionProps("itens")} title="Legenda do anúncio" summary={accessoriesSummary(accessories)}>
              {errors.accessories || legendAccessoriesError(accessories) ? <p role="alert" className="mb-3 text-sm text-red-400">{errors.accessories || legendAccessoriesError(accessories)}</p> : null}
              {priceMismatch || errors.description ? <p role="alert" data-testid="description-price-mismatch" className="mb-3 text-sm text-red-400">{priceSaveBlocked ? "Não dá para salvar assim. " : ""}{errors.description || priceMismatch?.blockMessage}</p> : null}
              <LegendPasteField key={legendRevision} description={description} accessories={accessories}
                data={{ ...values, year, yearModel, color, transmission, fuel, engine }}
                onChange={applyLegend}
                onRemoveDescription={() => { setDescription(""); setDirty(true); }}
                onRemoveItem={item => setAccessories(current => current.filter(entry => entry !== item))}
                onFieldChange={changeLegendField}
              />
            </Section>
          </div>

          {mode === "create" ? (
            <div hidden={isWizard && !SECTIONS_BY_STEP[step].includes("operacao")} style={isWizard ? { order: 0 } : undefined}>
          <Section
              {...sectionProps("operacao")}
              summary={
                consigned
                  ? `${CONSIGNED_LABEL} · sem compra nem custos`
                  : "Opcional · não aparece no site"
              }
              action={
                <span className="text-xs text-muted">
                  Não aparece no site
                </span>
              }
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
                      onChange={(event) =>
                        setPurchase(event.target.value)
                      }
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
            </Section>
          </div>
          ) : null}
          </div>

          {isWizard ? (
            <VehicleWizardNav
              step={step}
              errorSteps={([1, 2, 3, 4] as const).filter(candidate => Object.keys(errors).some(field => stepForField(field) === candidate))}
              disabled={saving || draftSaving}
              onBack={() => changeStep((step - 1) as VehicleWizardStep)}
              onNext={() => { if (validate(step)) changeStep((step + 1) as VehicleWizardStep); }}
            >
              <SubmitButton pending={saving} label={mode === "create" ? "Cadastrar veículo" : "Salvar alterações"} disabled={photosUploading || draftSaving} />
            </VehicleWizardNav>
          ) : null}
          {/* Barra de ações fixa: salvar sempre ao alcance, sem rolar a página. */}
          <div hidden={isWizard} className="fixed inset-x-0 bottom-admin-nav z-20 border-t border-white/10 bg-asphalt/95 px-3 py-2.5 backdrop-blur sm:px-6 sm:py-3 lg:sticky lg:inset-x-auto lg:-mx-8 lg:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1 sm:flex-none">
                <SubmitButton
                  pending={saving}
                  label={
                    mode === "create"
                      ? "Cadastrar veículo"
                      : "Salvar alterações"
                  }
                  disabled={photosUploading || priceSaveBlocked || draftSaving}
                  disabledLabel={
                    photosUploading
                      ? "Aguarde as fotos..."
                      : priceSaveBlocked
                        ? "Corrija o preço da descrição"
                        : undefined
                  }
                />
              </div>
              <Link
                prefetch={false}
                href="/admin/veiculos"
                className={`${btn.outline} ${mode === "edit" ? "hidden sm:inline-flex" : ""}`}
              >
                Voltar
              </Link>
              {dirty && !saving ? (
                <span
                  className="text-xs text-brand-orange"
                  aria-live="polite"
                  data-testid="unsaved-changes"
                >
                  Alterações não salvas
                </span>
              ) : null}

              {mode === "edit" && vehicle ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    aria-label="Mais ações do anúncio"
                    aria-haspopup="dialog"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-white/15 text-cream transition touch-manipulation active:bg-white/10 sm:hidden"
                  >
                    <IconMore className="h-5 w-5" />
                  </button>
                  <div className="hidden sm:contents">
                    <Link
                      prefetch={false}
                      href={vehiclePath(vehicle)}
                      target="_blank"
                      className={btn.ghost}
                    >
                      <IconExternal className="h-4 w-4" />
                      Ver no site
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPromoOpen(true)}
                      className={btn.ghost}
                    >
                      <IconExternal className="h-4 w-4" />
                      Kit de divulgação
                    </button>
                    {vehicle.status !== "vendido" ? (
                      <button
                        type="button"
                        onClick={() => setConfirmSold(true)}
                        disabled={pendingAction}
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-brand-orange/50 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-brand-orange transition hover:bg-brand-orange/10 disabled:opacity-60"
                        title="O veículo só será marcado como vendido ao concluir o contrato"
                      >
                        Iniciar venda
                      </button>
                    ) : (
                      <span className="inline-flex min-h-[44px] items-center justify-center font-display text-xs font-semibold uppercase tracking-wide text-muted">
                        Já vendido
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      disabled={pendingAction}
                      className={btn.danger}
                      title="Apaga o registro e a página — use só em duplicata/erro"
                    >
                      <IconTrash className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </fieldset>
      </form>

      {mode === "edit" && vehicle ? (
        <ActionSheet
          open={moreOpen}
          title={`${vehicle.brand} ${vehicle.model}`}
          subtitle="Ações do anúncio"
          onClose={() => setMoreOpen(false)}
        >
          <ActionSheetLink
            href={vehiclePath(vehicle)}
            external
            icon={<IconExternal className="h-4 w-4" />}
            label="Ver no site"
            hint="Abre a página pública em outra aba"
            onNavigate={() => setMoreOpen(false)}
          />
          <ActionSheetButton
            icon={<IconExternal className="h-4 w-4" />}
            label="Kit de divulgação"
            hint="WhatsApp, Instagram e card Status"
            onClick={() => {
              setMoreOpen(false);
              setPromoOpen(true);
            }}
          />
          {vehicle.status !== "vendido" ? (
            <ActionSheetButton
              icon={<IconCash className="h-4 w-4" />}
              label="Iniciar venda"
              hint="O estoque só muda ao concluir o contrato"
              tone="warning"
              disabled={pendingAction}
              onClick={() => {
                setMoreOpen(false);
                setConfirmSold(true);
              }}
            />
          ) : null}
          <ActionSheetLink
            href="/admin/veiculos"
            label="Voltar para a lista"
            hint="Alterações não salvas se perdem"
            onNavigate={() => setMoreOpen(false)}
          />
          <ActionSheetButton
            icon={<IconTrash className="h-4 w-4" />}
            label="Excluir definitivamente"
            hint="Só para duplicata ou erro — a página vira 404"
            tone="danger"
            disabled={pendingAction}
            onClick={() => {
              setMoreOpen(false);
              setConfirmDelete(true);
            }}
          />
        </ActionSheet>
      ) : null}

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir definitivamente"
        description={`Apagar ${vehicle ? `${vehicle.brand} ${vehicle.model}` : "este veículo"} do banco? A página some (404) e isso prejudica o SEO. Prefira “Marcar como vendido” quando o carro foi vendido. Use exclusão só para cadastro duplicado ou erro.`}
        confirmLabel="Excluir definitivamente"
        danger
        loading={pendingAction}
        typedPhrase={
          vehicle &&
          deleteRequiresTypedConfirm({
            photoCount: photos.length,
            status: vehicle.status,
          })
            ? DELETE_CONFIRM_PHRASE
            : undefined
        }
        typedLabel="Digite EXCLUIR para confirmar"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          handleDelete();
        }}
      />

      <ConfirmDialog
        open={confirmSold}
        title="Iniciar venda"
        description={`Abrir o fluxo de venda de ${vehicle ? `${vehicle.brand} ${vehicle.model}` : "este veículo"}? O anúncio só será marcado como vendido ao concluir o contrato.`}
        confirmLabel="Iniciar venda"
        danger={false}
        loading={pendingAction}
        onCancel={() => setConfirmSold(false)}
        onConfirm={() => {
          setConfirmSold(false);
          handleMarkSold();
        }}
      />

      <VehiclePromoKitModal
        vehicle={
          vehicle
            ? {
                ...vehicle,
                photos,
                accessories,
              }
            : null
        }
        open={promoOpen}
        onClose={() => setPromoOpen(false)}
      />
    </>
  );
}
