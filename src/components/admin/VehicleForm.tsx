"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useMemo, useState, useTransition } from "react";
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
  IconExternal,
  IconStar,
  IconTrash,
} from "@/components/admin/icons";
import { Card, Field, btn, inputClass } from "@/components/admin/ui";
import {
  VehiclePhotoManager,
  photosFromUrls,
  type PhotoItem,
} from "@/components/admin/VehiclePhotoManager";
import { formatNumberBR } from "@/lib/format";
import { vehiclePath } from "@/lib/vehicle-slug";
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

type VehicleWithPhotos = Vehicle & { photos: Photo[] };

const STATUSES = [
  { value: "disponivel", label: "Disponível" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
];

const initialState: VehicleFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btn.primary}>
      {pending ? "Salvando..." : label}
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
  const [state, formAction] = useFormState(action, initialState);

  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    photosFromUrls(
      vehicle?.photos
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((photo) => photo.url) ?? [],
    ),
  );
  const [accessories, setAccessories] = useState<string[]>(() =>
    normalizeAccessories(vehicle?.accessories ?? []),
  );
  const [customAccessory, setCustomAccessory] = useState("");
  const [category, setCategory] = useState<VehicleCategory>(() =>
    parseVehicleCategory(vehicle?.category),
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
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) toast.success("Veículo atualizado com sucesso.");
  }, [state]);

  const [values, setValues] = useState({
    price: vehicle?.price != null ? formatNumberBR(vehicle.price) : "",
    km: vehicle?.km != null ? formatNumberBR(vehicle.km) : "",
  });

  const fuelOptions = getFuels(category);
  const transmissionOptions = getTransmissions(category);
  const accessoryPresets = getAccessoryPresets(category);
  const isMoto = category === "moto";

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

    if (!brand) next.brand = "Informe a marca.";
    if (!model) next.model = "Informe o modelo.";
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
    if (km === "") next.km = "Informe a quilometragem.";
    if (!price || Number(price) <= 0) next.price = "Informe um preço válido.";

    setErrors(next);
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
        toast.success("Veículo marcado como vendido.");
        router.refresh();
      } catch {
        toast.error("Erro ao atualizar o status.");
      }
    });
  }

  const errorBorder = "border-brand/60";

  return (
    <>
      <form
        id="vehicle-form"
        action={formAction}
        onSubmit={(event) => {
          if (!validate()) {
            event.preventDefault();
            toast.error("Corrija os campos destacados.");
          }
        }}
        className="space-y-5"
      >
        <input
          type="hidden"
          name="photoUrls"
          value={JSON.stringify(photos.map((photo) => photo.url))}
        />
        <input
          type="hidden"
          name="accessories"
          value={JSON.stringify(accessories)}
        />
        <input type="hidden" name="price" value={values.price.replace(/\D/g, "")} />
        <input type="hidden" name="km" value={values.km.replace(/\D/g, "")} />

        <Card title="Tipo do anúncio">
          <input type="hidden" name="category" value={category} />
          <div className="grid gap-3 sm:grid-cols-2">
            {VEHICLE_CATEGORIES.map((option) => {
              const selected = category === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeCategory(option.value)}
                  className={`border px-4 py-4 text-left transition ${
                    selected
                      ? "border-brand bg-brand/10 text-cream"
                      : "border-white/10 bg-ink text-muted hover:border-white/25 hover:text-cream"
                  }`}
                >
                  <span className="font-display text-sm font-semibold uppercase tracking-wide">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed opacity-80">
                    {option.value === "moto"
                      ? "Checklist e opções de moto (ABS, bauleto, painel digital…)."
                      : "Checklist e opções de carro (multimídia, ar, bancos…)."}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="Identificação">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marca" required error={errors.brand}>
              <input
                name="brand"
                defaultValue={vehicle?.brand}
                placeholder={isMoto ? "Ex.: Honda" : "Ex.: Volkswagen"}
                className={`${inputClass} ${errors.brand ? errorBorder : ""}`}
              />
            </Field>
            <Field label="Modelo" required error={errors.model}>
              <input
                name="model"
                defaultValue={vehicle?.model}
                placeholder={isMoto ? "Ex.: CB 500F" : "Ex.: Golf"}
                className={`${inputClass} ${errors.model ? errorBorder : ""}`}
              />
            </Field>
            <Field label={isMoto ? "Versão / cilindrada" : "Versão"}>
              <input
                name="version"
                defaultValue={vehicle?.version ?? ""}
                placeholder={isMoto ? "Ex.: ABS 2023" : "Ex.: GTI 2.0 TSI"}
                className={inputClass}
              />
            </Field>
            <Field label="Cor">
              <input
                name="color"
                defaultValue={vehicle?.color ?? ""}
                placeholder="Ex.: Prata"
                className={inputClass}
              />
            </Field>
          </div>
        </Card>

        <Card title="Ficha técnica">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Ano de fabricação" required error={errors.year}>
              <input
                name="year"
                type="number"
                inputMode="numeric"
                defaultValue={vehicle?.year ?? new Date().getFullYear()}
                className={`${inputClass} ${errors.year ? errorBorder : ""}`}
              />
            </Field>
            <Field label="Ano modelo" required error={errors.yearModel}>
              <input
                name="yearModel"
                type="number"
                inputMode="numeric"
                defaultValue={vehicle?.yearModel ?? new Date().getFullYear()}
                className={`${inputClass} ${errors.yearModel ? errorBorder : ""}`}
              />
            </Field>
            <Field label="Quilometragem" required error={errors.km}>
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
            <Field label="Combustível">
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
            <Field label={isMoto ? "Câmbio / transmissão" : "Câmbio"}>
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
            </Field>
            <Field
              label={isMoto ? "Motor / cilindrada" : "Motor"}
              hint={isMoto ? "Ex.: 500cc" : "Ex.: 1.0 TSI"}
            >
              <input
                name="engine"
                defaultValue={vehicle?.engine ?? ""}
                placeholder={isMoto ? "Ex.: 500cc" : "Ex.: 2.0 Flex"}
                className={inputClass}
              />
            </Field>
            {!isMoto ? (
              <Field label="Portas">
                <input
                  name="doors"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={6}
                  defaultValue={vehicle?.doors ?? ""}
                  placeholder="Ex.: 4"
                  className={inputClass}
                />
              </Field>
            ) : (
              <input type="hidden" name="doors" value="" />
            )}
          </div>
        </Card>

        <Card title="Procedência e garantia">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Final da placa" hint="Ex.: 1 ou 2/3">
              <input
                name="plateEnd"
                defaultValue={vehicle?.plateEnd ?? ""}
                placeholder="Ex.: 7"
                className={inputClass}
              />
            </Field>
            <Field label="Garantia" hint="Ex.: 3 meses, fábrica">
              <input
                name="warranty"
                defaultValue={vehicle?.warranty ?? ""}
                placeholder="Ex.: 3 meses"
                className={inputClass}
              />
            </Field>
            <Field
              label="Laudo / vistoria"
              hint="Ex.: Cautelar aprovado"
              className="sm:col-span-2 lg:col-span-1"
            >
              <input
                name="inspection"
                defaultValue={vehicle?.inspection ?? ""}
                placeholder="Ex.: Laudo cautelar aprovado"
                className={inputClass}
              />
            </Field>
          </div>
        </Card>

        <Card title="Preço e vitrine">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Preço (R$)"
              required
              error={errors.price}
              hint="Valor anunciado no site."
            >
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
                className={`${inputClass} ${errors.price ? errorBorder : ""}`}
              />
            </Field>
            <Field label="Status">
              <select
                name="status"
                defaultValue={vehicle?.status ?? "disponivel"}
                className={inputClass}
              >
                {STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-end">
              <label className="flex w-full cursor-pointer items-center gap-2.5 border border-white/10 bg-ink px-3 py-2.5 text-sm text-cream transition hover:border-brand/50">
                <input
                  type="checkbox"
                  name="featured"
                  defaultChecked={vehicle?.featured ?? false}
                  className="h-4 w-4 accent-brand"
                />
                <IconStar className="h-4 w-4 text-brand-yellow" />
                Destaque na vitrine
              </label>
            </div>
          </div>
        </Card>

        <Card
          title={`Fotos${photos.length > 0 ? ` (${photos.length})` : ""}`}
          action={
            photos.length > 0 ? (
              <span className="text-xs text-muted">
                Arraste para reordenar · 1ª = capa
              </span>
            ) : null
          }
        >
          <VehiclePhotoManager photos={photos} onChange={setPhotos} />
        </Card>

        <Card
          title={`Acessórios e itens · ${isMoto ? "moto" : "carro"}${
            accessories.length > 0 ? ` (${accessories.length})` : ""
          }`}
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
                  className={`flex cursor-pointer items-center gap-2.5 border px-3 py-2.5 text-sm transition ${
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
              hint={
                isMoto
                  ? "Ex.: único dono, revisões na concessionária, pneus novos."
                  : "Ex.: único dono, revisões na concessionária, pneus novos."
              }
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
                    className="inline-flex items-center gap-2 border border-white/15 bg-ink px-2.5 py-1.5 text-xs text-cream"
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
                      className="text-muted transition hover:text-brand"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Card>

        <Card title="Descrição">
          <Field
            label="Texto do anúncio"
            hint="Conte o estado do veículo, revisões e o que ajuda a vender. Os acessórios ficam na lista acima."
          >
            <textarea
              name="description"
              rows={5}
              defaultValue={vehicle?.description ?? ""}
              className={`${inputClass} resize-y`}
            />
          </Field>
        </Card>

        {/* Barra de ações fixa: salvar sempre ao alcance, sem rolar a página. */}
        <div className="sticky bottom-0 -mx-4 border-t border-white/10 bg-asphalt/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton
              label={mode === "create" ? "Cadastrar veículo" : "Salvar alterações"}
            />
            <Link href="/admin/veiculos" className={btn.outline}>
              Voltar
            </Link>

            {mode === "edit" && vehicle ? (
              <>
                <Link
                  href={vehiclePath(vehicle)}
                  target="_blank"
                  className={`${btn.ghost} ml-auto`}
                >
                  <IconExternal className="h-4 w-4" />
                  Ver no site
                </Link>
                {vehicle.status !== "vendido" ? (
                  <button
                    type="button"
                    onClick={() => setConfirmSold(true)}
                    disabled={pendingAction}
                    className="inline-flex items-center gap-2 border border-brand-orange/50 px-4 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-brand-orange transition hover:bg-brand-orange/10 disabled:opacity-60"
                    title="Tira do estoque, mas mantém a página no site (SEO)"
                  >
                    Marcar como vendido
                  </button>
                ) : (
                  <span className="font-display text-xs font-semibold uppercase tracking-wide text-muted">
                    Já marcado como vendido
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
                  Excluir definitivamente
                </button>
              </>
            ) : null}
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir definitivamente"
        description={`Apagar ${vehicle ? `${vehicle.brand} ${vehicle.model}` : "este veículo"} do banco? A página some (404) e isso prejudica o SEO. Prefira “Marcar como vendido” quando o carro foi vendido. Use exclusão só para cadastro duplicado ou erro.`}
        confirmLabel="Excluir definitivamente"
        danger
        loading={pendingAction}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          handleDelete();
        }}
      />

      <ConfirmDialog
        open={confirmSold}
        title="Marcar como vendido"
        description={`Confirmar venda de ${vehicle ? `${vehicle.brand} ${vehicle.model}` : "este veículo"}? O anúncio sai do estoque e do sitemap, mas a página continua no ar com aviso de vendido (sem 404). Para registrar valor e cliente, use a tela de Vendas.`}
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
