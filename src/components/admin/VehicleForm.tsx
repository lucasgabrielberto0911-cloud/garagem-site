"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import type { Photo, Vehicle } from "@prisma/client";
import {
  createVehicle,
  deleteVehicle,
  markVehicleAsSold,
  updateVehicle,
  type VehicleFormState,
} from "@/app/admin/veiculos/actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  ActionSheet,
  ActionSheetButton,
  ActionSheetLink,
} from "@/components/admin/ActionSheet";
import { FormSection } from "@/components/admin/FormSection";
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
  type PhotoItem,
} from "@/components/admin/VehiclePhotoManager";
import { FipeLookup, type FipeApplyPayload } from "@/components/admin/FipeLookup";
import {
  formatCurrencyBRL,
  formatNumberBR,
  formatPlateDisplay,
} from "@/lib/format";
import { plateEndFromPlate } from "@/lib/plate-lookup";
import { vehiclePath } from "@/lib/vehicle-slug";
import {
  suggestedTransmission,
  transmissionConflictAlert,
} from "@/lib/vehicle-display";
import {
  VEHICLE_CATEGORIES,
  defaultFuel,
  defaultTransmission,
  filterAccessoriesForCategory,
  getAccessoryPresets,
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
  DEFAULT_VEHICLE_LOCATION_CITY,
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

function sectionAnchor(id: VehicleFormSectionId) {
  return `secao-${id}`;
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
    <button type="submit" disabled={blocked} className={`${btn.primary} w-full sm:w-auto`}>
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
}: {
  vehicle?: VehicleWithPhotos;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const boundUpdate = useMemo(
    () => (vehicle ? updateVehicle.bind(null, vehicle.id) : createVehicle),
    [vehicle],
  );

  const action = mode === "create" ? createVehicle : boundUpdate;
  const [state, formAction, saving] = useActionState(action, initialState);

  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    photosFromRecords(
      vehicle?.photos
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((photo) => ({
          url: photo.url,
          thumbnailUrl: photo.thumbnailUrl,
        })) ?? [],
    ),
  );
  const [photosUploading, setPhotosUploading] = useState(false);
  const [accessories, setAccessories] = useState<string[]>(() =>
    normalizeAccessories(vehicle?.accessories ?? []),
  );
  const [customAccessory, setCustomAccessory] = useState("");
  const [category, setCategory] = useState<VehicleCategory>(() =>
    parseVehicleCategory(vehicle?.category),
  );
  const [locationCity, setLocationCity] = useState<VehicleLocationCity>(
    () =>
      parseVehicleLocationCity(vehicle?.locationCity) ??
      DEFAULT_VEHICLE_LOCATION_CITY,
  );
  const [fuel, setFuel] = useState(() => {
    const initialCategory = parseVehicleCategory(vehicle?.category);
    const options = getFuels(initialCategory);
    const current = vehicle?.fuel;
    return current && options.includes(current)
      ? current
      : defaultFuel(initialCategory);
  });
  const [transmission, setTransmission] = useState(() => {
    const initialCategory = parseVehicleCategory(vehicle?.category);
    const options = getTransmissions(initialCategory);
    const current = vehicle?.transmission;
    return current && options.includes(current)
      ? current
      : defaultTransmission(initialCategory);
  });
  const [pendingAction, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSold, setConfirmSold] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openSections, setOpenSections] = useState<Set<VehicleFormSectionId>>(
    () =>
      new Set(
        initialOpenSections(mode, {
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

  function revealSections(ids: VehicleFormSectionId[], scrollTo = ids[0]) {
    if (ids.length === 0) return;
    setOpenSections((current) => new Set([...current, ...ids]));
    if (!scrollTo) return;
    requestAnimationFrame(() => {
      document
        .getElementById(sectionAnchor(scrollTo))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) toast.success("Veículo atualizado com sucesso.");
  }, [state]);

  const [values, setValues] = useState({
    price: vehicle?.price != null ? formatNumberBR(vehicle.price) : "",
    km: vehicle?.km != null ? formatNumberBR(vehicle.km) : "",
  });
  const [brand, setBrand] = useState(vehicle?.brand ?? "");
  const [model, setModel] = useState(vehicle?.model ?? "");
  const [version, setVersion] = useState(vehicle?.version ?? "");
  const [color, setColor] = useState(vehicle?.color ?? "");
  const [year, setYear] = useState(
    String(vehicle?.year ?? new Date().getFullYear()),
  );
  const [yearModel, setYearModel] = useState(
    String(vehicle?.yearModel ?? new Date().getFullYear()),
  );
  const [plate, setPlate] = useState(
    vehicle?.plate ? formatPlateDisplay(vehicle.plate) : "",
  );
  const [plateEnd, setPlateEnd] = useState(vehicle?.plateEnd ?? "");
  const [fipePrice, setFipePrice] = useState<number | null>(
    vehicle?.fipePrice ?? null,
  );
  const [engine, setEngine] = useState(vehicle?.engine ?? "");
  const [purchase, setPurchase] = useState("");
  const [description, setDescription] = useState(vehicle?.description ?? "");
  const [status, setStatus] = useState(vehicle?.status ?? "disponivel");

  const fuelOptions = getFuels(category);
  const transmissionOptions = getTransmissions(category);
  const accessoryPresets = getAccessoryPresets(category);
  const isMoto = category === "moto";
  const transmissionAlert = transmissionConflictAlert(version, transmission);
  const transmissionSuggestion = suggestedTransmission(
    version,
    transmission,
    transmissionOptions,
  );
  const canFixTransmission = transmissionOptions.includes(transmissionSuggestion);
  const listedPrice = Number(values.price.replace(/\D/g, "") || 0);
  const priceMismatch = descriptionPriceMismatch(description, listedPrice);
  const priceSaveBlocked = Boolean(
    priceMismatch && descriptionPriceMismatchBlocksSave(status),
  );
  const alreadySold = vehicle?.status === "vendido";

  function changeCategory(next: VehicleCategory) {
    if (next === category) return;
    setCategory(next);
    setAccessories((current) => filterAccessoriesForCategory(current, next));
    const nextFuels = getFuels(next);
    const nextTransmissions = getTransmissions(next);
    setFuel((current) =>
      nextFuels.includes(current) ? current : defaultFuel(next),
    );
    setTransmission((current) =>
      nextTransmissions.includes(current)
        ? current
        : defaultTransmission(next),
    );
  }

  function applyFipeSelection(payload: FipeApplyPayload) {
    if (payload.brand) setBrand(payload.brand);
    if (payload.model) setModel(payload.model);
    if (payload.version) setVersion(payload.version);
    if (payload.color) setColor(payload.color);
    if (payload.engine) setEngine(payload.engine);
    if (payload.year != null) setYear(String(payload.year));
    if (payload.yearModel != null) setYearModel(String(payload.yearModel));
    if (payload.fipePrice !== undefined) setFipePrice(payload.fipePrice);
    if (payload.plateEnd) setPlateEnd(payload.plateEnd);
    if (payload.fuel) {
      const options = getFuels(category);
      const matched = options.find(
        (option) =>
          option.toLocaleLowerCase("pt-BR") ===
          payload.fuel!.toLocaleLowerCase("pt-BR"),
      );
      if (matched) setFuel(matched);
    }
    setErrors((current) => {
      const next = { ...current };
      if (payload.brand) delete next.brand;
      if (payload.model) delete next.model;
      if (payload.color) delete next.color;
      if (payload.year != null) delete next.year;
      if (payload.yearModel != null) delete next.yearModel;
      return next;
    });
  }

  function handlePlateChange(next: string) {
    setPlate(next);
    const end = plateEndFromPlate(next);
    if (end && !plateEnd) setPlateEnd(end);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const form = document.getElementById("vehicle-form") as HTMLFormElement;
    if (!form) return true;

    const value = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";

    const brand = value("brand").trim();
    const model = value("model").trim();
    const year = value("year");
    const yearModel = value("yearModel");
    const km = value("kmDisplay").replace(/\D/g, "");
    const price = value("priceDisplay").replace(/\D/g, "");
    const currentYear = new Date().getFullYear();

    if (!year || Number(year) < 1950 || Number(year) > currentYear + 1) {
      next.year = "Ano inválido.";
    }
    if (
      !yearModel ||
      Number(yearModel) < 1950 ||
      Number(yearModel) > currentYear + 2
    ) {
      next.yearModel = "Ano modelo inválido.";
    }

    const listingIssues = validateVehicleListing({
      brand,
      model,
      fuel,
      transmission,
      color: value("color").trim() || color,
      km: km === "" ? null : Number(km),
      price: price === "" ? null : Number(price),
      locationCity: value("locationCity").trim() || locationCity,
    });
    for (const issue of listingIssues) {
      if (issue.field === "form") continue;
      next[issue.field] = issue.message;
    }

    const listed = price === "" ? 0 : Number(price);
    const mismatch = descriptionPriceMismatch(value("description"), listed);
    if (mismatch && descriptionPriceMismatchBlocksSave(value("status") || status)) {
      next.description = mismatch.blockMessage;
    }

    // O form usa noValidate: seção fechada esconde o campo e o navegador não
    // conseguiria focar o balão de erro nativo.
    for (const element of Array.from(form.elements)) {
      const control = element as HTMLInputElement;
      if (!control.name || !control.willValidate || control.validity.valid) continue;
      if (!sectionForField(control.name) || next[control.name]) continue;
      next[control.name] = control.validationMessage || "Valor inválido.";
    }

    setErrors(next);
    revealSections(sectionsWithErrors(next));
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
    startTransition(async () => {
      try {
        await markVehicleAsSold(vehicle.id);
        toast.success("Veículo movido para a aba Vendidos.");
        router.push("/admin/veiculos?tab=vendidos");
      } catch {
        toast.error("Erro ao atualizar o status.");
      }
    });
  }

  const errorBorder = "border-brand/60";
  const sections = vehicleFormSections(mode);
  const errorSections = new Map<VehicleFormSectionId, number>();
  for (const [field, message] of Object.entries(errors)) {
    const section = message ? sectionForField(field) : null;
    if (section) errorSections.set(section, (errorSections.get(section) ?? 0) + 1);
  }
  const sectionProps = (id: VehicleFormSectionId) => ({
    id: sectionAnchor(id),
    title: sections.find((section) => section.id === id)?.label ?? id,
    open: openSections.has(id),
    onToggle: () => toggleSection(id),
    errorCount: errorSections.get(id) ?? 0,
  });
  const statusLabel =
    STATUSES.find((item) => item.value === status)?.label ?? status;
  const cityLabel =
    VEHICLE_LOCATION_CITIES.find((option) => option.value === locationCity)
      ?.label ?? "";

  return (
    <>
      <nav
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
                    ? "border-brand/60 text-brand"
                    : "border-white/10 text-muted hover:text-cream"
                }`}
              >
                {section.nav}
                {count > 0 ? (
                  <span className="h-1.5 w-1.5 bg-brand" aria-label="com erro" />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      <form
        id="vehicle-form"
        noValidate
        onSubmit={(event) => {
          // Dispara a action na mão: com <form action>, o React 19 reseta o
          // form ao terminar e o select de status volta a mostrar o valor
          // antigo — o próximo "Salvar" regravaria o status errado.
          event.preventDefault();
          if (saving) return;
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
            revealSections(["descricao"]);
            return;
          }
          if (!validate()) {
            toast.error("Corrija os campos destacados.");
            return;
          }
          const data = new FormData(event.currentTarget);
          startTransition(() => formAction(data));
        }}
        className="space-y-3 sm:space-y-4"
      >
        <input
          type="hidden"
          name="photoUrls"
          value={JSON.stringify(
            photos.map((photo) => ({
              url: photo.url,
              thumbnailUrl: photo.thumbnailUrl ?? null,
            })),
          )}
        />
        <input
          type="hidden"
          name="accessories"
          value={JSON.stringify(accessories)}
        />
        <input type="hidden" name="price" value={values.price.replace(/\D/g, "")} />
        <input type="hidden" name="km" value={values.km.replace(/\D/g, "")} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="locationCity" value={locationCity} />

        <FormSection
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
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
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
          <FipeLookup
            category={category}
            plate={plate}
            onPlateChange={handlePlateChange}
            initialFipePrice={vehicle?.fipePrice}
            onApply={applyFipeSelection}
          />
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
        </FormSection>

        <FormSection
          {...sectionProps("essencial")}
          summary={[
            values.price ? `R$ ${values.price}` : "Sem preço",
            statusLabel,
            cityLabel,
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4">
            <Field label="Preço (R$)" required error={errors.price}>
              <input
                name="priceDisplay"
                inputMode="numeric"
                value={values.price}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    price: formatNumberBR(
                      Number(event.target.value.replace(/\D/g, "") || 0),
                    ),
                  }))
                }
                placeholder="0"
                className={`${inputClass} font-display text-lg font-semibold ${errors.price ? errorBorder : ""}`}
              />
              {fipePrice != null && fipePrice > 0 ? (
                <p
                  className="mt-2 text-xs text-muted"
                  data-testid="fipe-price-reference"
                >
                  Referência FIPE:{" "}
                  <span className="font-medium text-cream">
                    {formatCurrencyBRL(fipePrice)}
                  </span>
                </p>
              ) : null}
            </Field>
            <Field label="Status">
              <select
                name="status"
                value={status}
                onChange={(event) => {
                  if (event.target.value === "vendido" && !alreadySold) {
                    toast.message(
                      "Para vender, use o botão “Marcar vendido”. Assim a página continua no ar.",
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
                      ? "Vendido — use “Marcar vendido”"
                      : item.label}
                  </option>
                ))}
              </select>
            </Field>
            <p className="col-span-2 -mt-2 text-xs leading-relaxed text-muted">
              {alreadySold
                ? "Já vendido. Disponível/reservado volta para o estoque ao salvar."
                : "Para vender, use “Marcar vendido” — a página continua no ar."}
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
                  onClick={() => revealSections(["descricao"])}
                  className={`${btn.outline} shrink-0`}
                >
                  Ver descrição
                </button>
              </div>
            ) : null}

            <div className="col-span-2 sm:col-span-1">
              <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
                Onde está o veículo
              </span>
              <div
                className="flex gap-2"
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
                      <span className="text-[10px] uppercase tracking-wider opacity-70">
                        ES
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.locationCity ? (
                <p className="mt-1.5 text-xs text-brand">{errors.locationCity}</p>
              ) : (
                <details className="mt-1.5 text-xs text-muted">
                  <summary className="cursor-pointer py-1 touch-manipulation">
                    Para que serve?
                  </summary>
                  <p className="mt-1 leading-relaxed">{VEHICLE_LOCATION_HINT}</p>
                </details>
              )}
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
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
                Até 8 na home, só disponível. A home não escolhe carro sozinha.
              </p>
            </div>
          </div>
        </FormSection>

        <FormSection
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
            photos={photos}
            onChange={setPhotos}
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
          <p className="mt-2 text-xs text-muted">
            Não sobe o vídeo no site — só tira o aviso “sem vídeo” no estoque.
            O visitante continua pedindo pelo WhatsApp.
          </p>
        </FormSection>

        <FormSection
          {...sectionProps("ficha")}
          summary={fichaSummary({ year, yearModel, km: values.km, transmission, fuel })}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Ano de fabricação" required error={errors.year}>
              <input
                name="year"
                type="number"
                inputMode="numeric"
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className={`${inputClass} ${errors.year ? errorBorder : ""}`}
              />
            </Field>
            <Field label="Ano modelo" required error={errors.yearModel}>
              <input
                name="yearModel"
                type="number"
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
                kmHint(Number(values.km.replace(/\D/g, "") || Number.NaN)) ??
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
                    km: formatNumberBR(
                      Number(event.target.value.replace(/\D/g, "") || 0),
                    ),
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
                {fuelOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={isMoto ? "Câmbio / transmissão" : "Câmbio"}
              error={errors.transmission}
            >
              <select
                name="transmission"
                value={transmission}
                onChange={(event) => setTransmission(event.target.value)}
                className={inputClass}
                required
              >
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
            <Field label="Final da placa" hint="Ex.: 1 ou 2/3 — visível no site">
              <input
                name="plateEnd"
                value={plateEnd}
                onChange={(event) => setPlateEnd(event.target.value)}
                placeholder="Ex.: 7"
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
        </FormSection>

        <FormSection
          {...sectionProps("descricao")}
          summary={
            priceMismatch
              ? "Preço do texto ≠ preço do anúncio"
              : descriptionSummary(description)
          }
        >
          {priceMismatch ? (
            <div
              role={priceSaveBlocked ? "alert" : "status"}
              data-testid="description-price-mismatch"
              className={`mb-4 border px-3 py-3 text-sm text-cream ${
                priceSaveBlocked
                  ? "border-brand/50 bg-brand/10"
                  : "border-brand-orange/40 bg-brand-orange/10"
              }`}
            >
              <p
                className={`font-display text-xs font-semibold uppercase tracking-wider ${
                  priceSaveBlocked ? "text-brand" : "text-brand-orange"
                }`}
              >
                {priceSaveBlocked
                  ? "Não dá para salvar assim"
                  : "Preço do texto ≠ preço do anúncio"}
              </p>
              <p className="mt-1 leading-relaxed text-cream/90">
                {priceSaveBlocked
                  ? priceMismatch.blockMessage
                  : priceMismatch.message}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                {priceSaveBlocked
                  ? "Disponível e destaque na home ficam bloqueados até o texto e o preço baterem."
                  : "Reservado ou vendido ainda salvam. Para voltar ao estoque, o texto e o preço precisam bater."}
              </p>
            </div>
          ) : null}
          <Field
            label="Texto do anúncio"
            error={errors.description}
            hint="Conte o estado do veículo, revisões e o que ajuda a vender. Os acessórios ficam na lista de itens."
          >
            <textarea
              name="description"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${inputClass} resize-y ${
                priceMismatch ? "border-brand-orange/50" : ""
              } ${errors.description ? errorBorder : ""}`}
            />
          </Field>
        </FormSection>

        <FormSection
          {...sectionProps("itens")}
          title={`Acessórios e itens · ${isMoto ? "moto" : "carro"}${
            accessories.length > 0 ? ` (${accessories.length})` : ""
          }`}
          summary={accessoriesSummary(accessories)}
        >
          <p className="mb-4 text-xs leading-relaxed text-muted">
            Opções prontas para {isMoto ? "moto" : "carro"}. Você também pode
            escrever pontos manuais — tudo vira lista no anúncio.
          </p>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {accessoryPresets.map((preset) => {
              const checked = accessories.some(
                (item) =>
                  item.toLocaleLowerCase("pt-BR") ===
                  preset.toLocaleLowerCase("pt-BR"),
              );
              return (
                <label
                  key={preset}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 border px-3 py-2.5 text-sm transition touch-manipulation ${
                    checked
                      ? "border-brand/50 bg-brand/10 text-cream"
                      : "border-white/10 bg-ink text-muted hover:border-white/25 hover:text-cream"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setAccessories((current) => {
                        if (checked) {
                          return current.filter(
                            (item) =>
                              item.toLocaleLowerCase("pt-BR") !==
                              preset.toLocaleLowerCase("pt-BR"),
                          );
                        }
                        return normalizeAccessories([...current, preset]);
                      });
                    }}
                    className="h-4 w-4 accent-brand"
                  />
                  {preset}
                </label>
              );
            })}
          </div>

          <div className="mt-5 border-t border-white/10 pt-5">
            <Field
              label="Ponto manual"
              hint="Ex.: único dono, revisões na concessionária, pneus novos."
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={customAccessory}
                  onChange={(event) => setCustomAccessory(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const value = customAccessory.trim();
                      if (!value) return;
                      setAccessories((current) =>
                        normalizeAccessories([...current, value]),
                      );
                      setCustomAccessory("");
                    }
                  }}
                  placeholder="Digite e pressione Enter ou clique em Adicionar"
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => {
                    const value = customAccessory.trim();
                    if (!value) return;
                    setAccessories((current) =>
                      normalizeAccessories([...current, value]),
                    );
                    setCustomAccessory("");
                  }}
                  className={`${btn.outline} shrink-0`}
                >
                  Adicionar
                </button>
              </div>
            </Field>

            {accessories.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {accessories.map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-1 border border-white/15 bg-ink pl-2.5 text-xs text-cream"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      aria-label={`Remover ${item}`}
                      onClick={() =>
                        setAccessories((current) =>
                          current.filter((entry) => entry !== item),
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center text-base text-muted transition touch-manipulation hover:text-brand"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </FormSection>

        {mode === "create" ? (
          <FormSection
            {...sectionProps("operacao")}
            summary="Opcional · não aparece no site"
            action={
              <span className="text-[11px] text-muted">Não aparece no site</span>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Preço de compra"
                hint="Opcional. Custos extras entram depois, na aba Operação."
              >
                <input
                  name="purchasePrice"
                  inputMode="numeric"
                  value={purchase}
                  onChange={(event) =>
                    setPurchase(
                      formatNumberBR(
                        Number(event.target.value.replace(/\D/g, "") || 0),
                      ),
                    )
                  }
                  placeholder="0"
                  className={inputClass}
                />
              </Field>
              <div className="grid gap-2 sm:grid-cols-1">
                <label className="flex min-h-[44px] items-center gap-2 text-sm text-cream">
                  <input type="checkbox" name="inStoreName" className="h-4 w-4 accent-brand" />
                  Documento em nome da loja
                </label>
                <label className="flex min-h-[44px] items-center gap-2 text-sm text-cream">
                  <input type="checkbox" name="hasSpareKey" className="h-4 w-4 accent-brand" />
                  Chave reserva
                </label>
                <label className="flex min-h-[44px] items-center gap-2 text-sm text-cream">
                  <input type="checkbox" name="hasManual" className="h-4 w-4 accent-brand" />
                  Manual
                </label>
              </div>
            </div>
          </FormSection>
        ) : null}

        {/* Barra de ações fixa: salvar sempre ao alcance, sem rolar a página. */}
        <div className="sticky bottom-admin-nav z-20 -mx-3 border-t border-white/10 bg-asphalt/95 px-3 py-2.5 backdrop-blur sm:-mx-6 sm:px-6 sm:py-3 lg:-mx-8 lg:px-8">
          <div className="flex items-center gap-2 sm:flex-wrap">
            <div className="min-w-0 flex-1 sm:flex-none">
              <SubmitButton
                pending={saving}
                label={mode === "create" ? "Cadastrar veículo" : "Salvar alterações"}
                disabled={photosUploading || priceSaveBlocked}
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
              href="/admin/veiculos"
              className={`${btn.outline} ${mode === "edit" ? "hidden sm:inline-flex" : ""}`}
            >
              Voltar
            </Link>

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
                    href={vehiclePath(vehicle)}
                    target="_blank"
                    className={btn.ghost}
                  >
                    <IconExternal className="h-4 w-4" />
                    Ver no site
                  </Link>
                  {vehicle.status !== "vendido" ? (
                    <button
                      type="button"
                      onClick={() => setConfirmSold(true)}
                      disabled={pendingAction}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-brand-orange/50 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-brand-orange transition hover:bg-brand-orange/10 disabled:opacity-60"
                      title="Tira do estoque, mas mantém a página no site (SEO)"
                    >
                      Marcar vendido
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
          {vehicle.status !== "vendido" ? (
            <ActionSheetButton
              icon={<IconCash className="h-4 w-4" />}
              label="Marcar vendido"
              hint="Sai do estoque; a página continua no site"
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
        title="Marcar como vendido"
        description={`Confirmar venda de ${vehicle ? `${vehicle.brand} ${vehicle.model}` : "este veículo"}? Ele sai da aba Em estoque e vai para Vendidos. A página pública continua no ar com aviso (sem 404). Para registrar valor e cliente, use a tela de Vendas.`}
        confirmLabel="Marcar como vendido"
        danger={false}
        loading={pendingAction}
        onCancel={() => setConfirmSold(false)}
        onConfirm={() => {
          setConfirmSold(false);
          handleMarkSold();
        }}
      />
    </>
  );
}
