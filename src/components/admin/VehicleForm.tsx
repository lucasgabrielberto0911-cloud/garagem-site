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
import { VehicleImage } from "@/components/VehicleImage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";

type VehicleWithPhotos = Vehicle & { photos: Photo[] };

const FUELS = ["Flex", "Gasolina", "Etanol", "Diesel", "Híbrido", "Elétrico"];
const TRANSMISSIONS = ["Manual", "Automático", "CVT", "Automatizado"];
const STATUSES = [
  { value: "disponivel", label: "Disponível" },
  { value: "reservado", label: "Reservado" },
  { value: "vendido", label: "Vendido" },
];

const initialState: VehicleFormState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-brand px-5 py-2.5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:cursor-not-allowed disabled:opacity-60"
    >
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

  const [photoUrls, setPhotoUrls] = useState<string[]>(
    () => vehicle?.photos.sort((a, b) => a.order - b.order).map((p) => p.url) ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [pendingAction, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSold, setConfirmSold] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Show action result as toast
  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.success) toast.success("Veículo atualizado com sucesso.");
  }, [state]);

  const [values, setValues] = useState({
    price: vehicle?.price != null ? formatCurrencyInput(vehicle.price) : "",
    km: vehicle?.km != null ? formatNumberBR(vehicle.km) : "",
  });

  function formatCurrencyInput(num: number) {
    return new Intl.NumberFormat("pt-BR").format(num);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const form = document.getElementById("vehicle-form") as HTMLFormElement;
    if (!form) return true;

    const brand = (form.elements.namedItem("brand") as HTMLInputElement)?.value.trim();
    const model = (form.elements.namedItem("model") as HTMLInputElement)?.value.trim();
    const year = (form.elements.namedItem("year") as HTMLInputElement)?.value;
    const yearModel = (form.elements.namedItem("yearModel") as HTMLInputElement)?.value;
    const kmRaw = (form.elements.namedItem("kmDisplay") as HTMLInputElement)?.value;
    const priceRaw = (form.elements.namedItem("priceDisplay") as HTMLInputElement)?.value;

    if (!brand) next.brand = "Informe a marca.";
    if (!model) next.model = "Informe o modelo.";
    if (!year || Number(year) < 1900 || Number(year) > 2100) next.year = "Ano inválido.";
    if (!yearModel || Number(yearModel) < 1900 || Number(yearModel) > 2100)
      next.yearModel = "Ano modelo inválido.";
    if (!kmRaw || Number(kmRaw.replace(/\D/g, "")) < 0) next.km = "Informe a quilometragem.";
    if (!priceRaw || Number(priceRaw.replace(/\D/g, "")) <= 0)
      next.price = "Informe um preço válido.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append("files", file));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Falha no upload.");
        return;
      }

      setPhotoUrls((current) => [...current, ...(data.urls as string[])]);
      toast.success(`${data.urls.length} foto(s) enviada(s).`);
    } catch {
      toast.error("Erro de conexão no upload.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(url: string) {
    setPhotoUrls((current) => current.filter((item) => item !== url));
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

  const inputClass =
    "w-full border border-white/10 bg-ink px-3 py-2.5 text-cream outline-none focus:border-brand";
  const inputError = "border-brand/60";

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
        className="space-y-8"
      >
        <input type="hidden" name="photoUrls" value={JSON.stringify(photoUrls)} />
        {/* normalized numeric fields */}
        <input
          type="hidden"
          name="price"
          value={values.price.replace(/\D/g, "")}
        />
        <input type="hidden" name="km" value={values.km.replace(/\D/g, "")} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Marca" name="brand" defaultValue={vehicle?.brand} error={errors.brand} />
          <Field label="Modelo" name="model" defaultValue={vehicle?.model} error={errors.model} />
          <Field label="Versão" name="version" defaultValue={vehicle?.version ?? ""} />
          <Field label="Cor" name="color" defaultValue={vehicle?.color ?? ""} />
          <Field
            label="Ano"
            name="year"
            type="number"
            defaultValue={vehicle?.year ?? new Date().getFullYear()}
            error={errors.year}
          />
          <Field
            label="Ano modelo"
            name="yearModel"
            type="number"
            defaultValue={vehicle?.yearModel ?? new Date().getFullYear()}
            error={errors.yearModel}
          />

          {/* KM with thousands mask */}
          <label className="block text-sm">
            <span className="mb-2 block text-xs uppercase tracking-wider text-muted">
              KM
            </span>
            <input
              name="kmDisplay"
              inputMode="numeric"
              value={values.km}
              onChange={(event) =>
                setValues((v) => ({
                  ...v,
                  km: formatNumberBR(Number(event.target.value.replace(/\D/g, "") || 0)),
                }))
              }
              className={`${inputClass} ${errors.km ? inputError : ""}`}
              placeholder="0"
            />
            {errors.km ? <ErrorText message={errors.km} /> : null}
          </label>

          {/* Price with thousands mask */}
          <label className="block text-sm">
            <span className="mb-2 block text-xs uppercase tracking-wider text-muted">
              Preço (R$)
            </span>
            <input
              name="priceDisplay"
              inputMode="numeric"
              value={values.price}
              onChange={(event) =>
                setValues((v) => ({
                  ...v,
                  price: formatCurrencyInput(
                    Number(event.target.value.replace(/\D/g, "") || 0),
                  ),
                }))
              }
              className={`${inputClass} ${errors.price ? inputError : ""}`}
              placeholder="0"
            />
            {errors.price ? <ErrorText message={errors.price} /> : null}
          </label>

          <label className="block text-sm">
            <span className="mb-2 block text-xs uppercase tracking-wider text-muted">
              Combustível
            </span>
            <select name="fuel" defaultValue={vehicle?.fuel ?? "Flex"} className={inputClass} required>
              {FUELS.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {fuel}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block text-xs uppercase tracking-wider text-muted">
              Câmbio
            </span>
            <select
              name="transmission"
              defaultValue={vehicle?.transmission ?? "Automático"}
              className={inputClass}
              required
            >
              {TRANSMISSIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-2 block text-xs uppercase tracking-wider text-muted">
              Status
            </span>
            <select name="status" defaultValue={vehicle?.status ?? "disponivel"} className={inputClass}>
              {STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-end gap-2 pb-3 text-sm text-cream">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={vehicle?.featured ?? false}
              className="h-4 w-4 accent-brand"
            />
            Destaque na vitrine
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-2 block text-xs uppercase tracking-wider text-muted">
            Descrição
          </span>
          <textarea
            name="description"
            rows={4}
            defaultValue={vehicle?.description ?? ""}
            className={inputClass}
          />
        </label>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold tracking-tight text-cream">
              Fotos
            </h2>
            <label className="cursor-pointer border border-white/15 px-3 py-2 text-sm text-cream transition hover:border-brand hover:text-brand">
              {uploading ? "Enviando..." : "Adicionar fotos"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  void handleFilesSelected(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          </div>

          {uploading ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {[0, 1].map((i) => (
                <li key={i} className="aspect-[4/3] animate-pulse bg-ink" />
              ))}
            </ul>
          ) : null}

          {photoUrls.length === 0 && !uploading ? (
            <p className="text-sm text-muted">Nenhuma foto adicionada.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photoUrls.map((url) => (
                <li key={url} className="relative aspect-[4/3] overflow-hidden bg-ink">
                  <VehicleImage
                    src={url}
                    alt="Foto do veículo"
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="absolute right-2 top-2 bg-asphalt/80 px-2 py-1 text-xs text-cream hover:bg-brand"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
          <SubmitButton label={mode === "create" ? "Cadastrar" : "Salvar alterações"} />
          <Link
            href="/admin/veiculos"
            className="border border-white/15 px-4 py-2.5 text-sm text-muted transition hover:text-cream"
          >
            Voltar
          </Link>

          {mode === "edit" && vehicle ? (
            <>
              {vehicle.status !== "vendido" ? (
                <button
                  type="button"
                  onClick={() => setConfirmSold(true)}
                  disabled={pendingAction}
                  className="border border-brand-orange/50 px-4 py-2.5 text-sm text-brand-orange transition hover:bg-brand-orange/10 disabled:opacity-60"
                >
                  Marcar como vendido
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={pendingAction}
                className="border border-brand/50 px-4 py-2.5 text-sm text-brand transition hover:bg-brand/10 disabled:opacity-60"
              >
                Excluir
              </button>
            </>
          ) : null}
        </div>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir veículo"
        description={`Tem certeza que deseja excluir ${vehicle ? `${vehicle.brand} ${vehicle.model}` : "este veículo"}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
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
        description={`Confirmar venda de ${vehicle ? `${vehicle.brand} ${vehicle.model}` : "este veículo"}?`}
        confirmLabel="Confirmar"
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

function ErrorText({ message }: { message: string }) {
  return <p className="mt-1.5 text-xs text-brand">{message}</p>;
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  type?: string;
  error?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block text-xs uppercase tracking-wider text-muted">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className={`w-full border bg-ink px-3 py-2.5 text-cream outline-none focus:border-brand ${
          error ? "border-brand/60" : "border-white/10"
        }`}
      />
      {error ? <ErrorText message={error} /> : null}
    </label>
  );
}

// helper used above
export function formatKm(value: number) {
  return `${formatNumberBR(value)} km`;
}
export function formatPrice(value: number) {
  return formatCurrencyBRL(value);
}
