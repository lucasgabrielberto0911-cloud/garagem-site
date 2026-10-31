"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createVehicle,
  updateVehicle,
  type VehicleFormState,
} from "@/app/admin/veiculos/actions";
import { adminMutation } from "@/lib/admin-mutation";
import { photoQueueStorage } from "@/lib/admin-photo-queue-store";
import { focusAdminError } from "@/lib/admin-form-focus";
import { moneyInput, parseMoneyBR } from "@/lib/admin-money";
import { vehicleDraftScope } from "@/lib/preparation";
import {
  photosFromRecords,
  type PhotoItem,
} from "@/components/admin/VehiclePhotoManager";
import { useUnsavedChangesWarning } from "@/components/admin/useUnsavedChangesWarning";
import {
  formatNumberBR,
  formatPlateDisplay,
  resolvePlateEnd,
} from "@/lib/format";
import {
  suggestedTransmission,
  transmissionConflictAlert,
} from "@/lib/vehicle-display";
import {
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
} from "@/lib/admin-vehicle-validate";
import {
  parseVehicleLocationCity,
  type VehicleLocationCity,
} from "@/lib/vehicle-location";
import {
  SECTIONS_BY_STEP,
  sectionForField,
  sectionsWithErrors,
  vehicleFormSections,
  type VehicleFormSectionId,
  type VehicleWizardStep,
} from "@/lib/admin-form-sections";
import {
  stepForField,
  validateVehicleForm,
} from "@/lib/admin-vehicle-form-validate";
import type { LegendField, LegendParseResult } from "@/lib/legend-parser";
import {
  STATUSES,
  type VehicleFormProps,
  type VehicleWithPhotos,
} from "./types";

const initialState: VehicleFormState = {};
const sectionAnchor = (id: VehicleFormSectionId) => `secao-${id}`;

export function useVehicleFormState({
  vehicle,
  prefill,
  preparationId,
  draftId,
  mode,
  adminId,
  initialTab = "anuncio",
}: VehicleFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<VehicleWizardStep>(1);
  const init: Partial<VehicleWithPhotos> | undefined = vehicle ?? prefill;
  const [activeTab, setActiveTab] = useState<"anuncio" | "fotos">(
    initialTab === "fotos" ? "fotos" : "anuncio",
  );

  useEffect(() => {
    setActiveTab(initialTab === "fotos" ? "fotos" : "anuncio");
    if (initialTab === "fotos") setStep(1);
  }, [initialTab]);
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
  const draftScope = vehicleDraftScope(vehicle?.id, preparationId, draftId);
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
    () => parseVehicleLocationCity(init?.locationCity) ?? "",
  );
  const [fuel, setFuel] = useState(
    () =>
      init?.fuel ??
      (prefill ? "" : defaultFuel(parseVehicleCategory(init?.category))),
  );
  const [transmission, setTransmission] = useState(init?.transmission ?? "");
  const [pendingAction, startTransition] = useTransition();
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
  const revealSections = useCallback(
    (ids: VehicleFormSectionId[], scrollTo = ids[0]) => {
      if (ids.length === 0) return;
      const target = ([1, 2, 3, 4] as const).find((candidate) =>
        SECTIONS_BY_STEP[candidate].includes(scrollTo),
      );
      if (target) setStep(target);
      setActiveTab(ids.some((id) => id !== "fotos") ? "anuncio" : "fotos");
      if (!scrollTo) return;
      requestAnimationFrame(() => {
        document.getElementById(sectionAnchor(scrollTo))?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        });
      });
    },
    [],
  );

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
      if (tab === "fotos") setStep(1);
      window.history.replaceState(window.history.state, "", anchor.href);
    }
    window.addEventListener("click", onTabClick, true);
    return () => window.removeEventListener("click", onTabClick, true);
  }, [mode]);

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
        revealSections(sectionsWithErrors(state.fieldErrors));
        const target = ([1, 2, 3, 4] as const).find((candidate) =>
          Object.keys(state.fieldErrors ?? {}).some(
            (field) => stepForField(field, mode) === candidate,
          ),
        );
        if (target) setStep(target);
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
  }, [state, draftScope, adminId, router, revealSections, mode]);

  const [values, setValues] = useState({
    price: init?.price != null ? moneyInput(init.price) : "",
    km: init?.km != null ? formatNumberBR(init.km) : "",
  });
  const [brand, setBrand] = useState(init?.brand ?? "");
  const [model, setModel] = useState(init?.model ?? "");
  const [version, setVersion] = useState(init?.version ?? "");
  const [color, setColor] = useState(init?.color ?? "");
  const [year, setYear] = useState(init?.year != null ? String(init.year) : "");
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
    if (field === "price" || field === "km")
      setValues((current) => ({ ...current, [field]: value }));
    else
      ({
        year: setYear,
        yearModel: setYearModel,
        color: setColor,
        transmission: setTransmission,
        fuel: setFuel,
        engine: setEngine,
      })[field](value);
    setDirty(true);
  }

  function applyLegend(parsed: LegendParseResult) {
    setDescription(parsed.description);
    setAccessories(parsed.accessories);
    const current = {
      ...values,
      year,
      yearModel,
      color,
      transmission,
      fuel,
      engine,
    };
    for (const key of Object.keys(current)) {
      const field = key as LegendField;
      if (
        !current[field].trim() ||
        current[field] === autoLegendData.current[field]
      ) {
        const value = parsed.data[field] ?? "";
        if (
          parsed.data[field] !== undefined ||
          autoLegendData.current[field] !== undefined
        ) {
          changeLegendField(field, value);
          autoLegendData.current[field] = value;
        }
      }
    }
    setErrors((current) => {
      const next = { ...current };
      delete next.accessories;
      delete next.description;
      return next;
    });
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
    if (mode === "create") setDirty(true);
    requestAnimationFrame(() =>
      document.getElementById("wizard-title")?.focus(),
    );
  }

  function validate(onlyStep?: VehicleWizardStep): boolean {
    const form = document.getElementById("vehicle-form") as HTMLFormElement;
    if (!form) return true;
    // noValidate exige coletar as restrições nativas antes de revelar e focar a etapa.
    const invalidFields: Record<string, string> = {};
    for (const element of Array.from(form.elements)) {
      const control = element as HTMLInputElement;
      if (control.name && control.willValidate && !control.validity.valid)
        invalidFields[control.name] = control.validationMessage;
    }
    const next = validateVehicleForm(new FormData(form), {
      mode,
      status,
      fuel,
      transmission,
      color,
      locationCity,
      accessories,
      photoCount: photos.length,
      photosUploading,
      onlyStep,
      invalidFields,
    });
    setErrors((current) =>
      onlyStep
        ? {
            ...Object.fromEntries(
              Object.entries(current).filter(
                ([field]) => stepForField(field, mode) !== onlyStep,
              ),
            ),
            ...next,
          }
        : next,
    );
    revealSections(sectionsWithErrors(next));
    const errorStep = Object.keys(next).length
      ? ([1, 2, 3, 4] as const).find((candidate) =>
          Object.keys(next).some((field) => stepForField(field, mode) === candidate),
        )
      : undefined;
    if (errorStep) {
      setStep(errorStep);
    }
    const first =
      Array.from(form.elements)
        .filter(
          (control) =>
            !(control instanceof HTMLInputElement && control.type === "hidden"),
        )
        .map((control) => (control as HTMLInputElement).name)
        .map((name) =>
          name === "priceDisplay"
            ? "price"
            : name === "kmDisplay"
              ? "km"
              : name,
        )
        .find((field) => next[field] && stepForField(field, mode) === errorStep) ??
      Object.keys(next).find((field) => stepForField(field, mode) === errorStep);
    if (first === "locationCity") {
      requestAnimationFrame(() =>
        form
          .querySelector<HTMLButtonElement>(
            '[aria-label="Onde está o veículo"] button',
          )
          ?.focus(),
      );
    } else if (first === "photos") {
      requestAnimationFrame(() =>
        document.getElementById("wizard-title")?.focus(),
      );
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
    errorCount: errorSections.get(id) ?? 0,
  });
  const statusLabel =
    STATUSES.find((item) => item.value === status)?.label ?? status;

  return {
    step,
    setStep,
    photos,
    setPhotos,
    photosUploading,
    setPhotosUploading,
    draftScope,
    draftSaving,
    setDraftSaving,
    dirty,
    setDirty,
    state,
    formAction,
    saving,
    pendingAction,
    startTransition,
    changePhotos,
    accessories,
    setAccessoriesState,
    setAccessories,
    consigned,
    setConsigned,
    category,
    setCategory,
    locationCity,
    setLocationCity,
    fuel,
    setFuel,
    transmission,
    setTransmission,
    errors,
    setErrors,
    revealSections,
    values,
    setValues,
    brand,
    setBrand,
    model,
    setModel,
    version,
    setVersion,
    color,
    setColor,
    year,
    setYear,
    yearModel,
    setYearModel,
    plate,
    setPlate,
    plateEnd,
    engine,
    setEngine,
    purchase,
    setPurchase,
    description,
    setDescription,
    status,
    setStatus,
    autoLegendData,
    legendRevision,
    setLegendRevision,
    changeLegendField,
    applyLegend,
    fuelOptions,
    transmissionOptions,
    isMoto,
    transmissionAlert,
    transmissionSuggestion,
    canFixTransmission,
    listedPrice,
    priceMismatch,
    priceSaveBlocked,
    alreadySold,
    changeCategory,
    handlePlateChange,
    changeStep,
    validate,
    sectionProps,
    statusLabel,
  };
}

export type VehicleFormModel = ReturnType<typeof useVehicleFormState>;
