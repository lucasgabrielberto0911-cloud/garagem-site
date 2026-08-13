"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { VehicleCost, VehicleDocument } from "@prisma/client";
import {
  addVehicleCost,
  addVehicleDocument,
  deleteVehicleCost,
  deleteVehicleDocument,
  updateVehicleOps,
} from "@/app/admin/veiculos/ops-actions";
import {
  IconCheck,
  IconDownload,
  IconPlus,
  IconTrash,
} from "@/components/admin/icons";
import { Badge, Card, Field, btn, inputClass } from "@/components/admin/ui";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { uploadAdminFile } from "@/lib/upload-admin-file";
import {
  VEHICLE_COST_KINDS,
  VEHICLE_DOC_KINDS,
  costKindLabel,
  docKindLabel,
  expectedMargin,
  investedTotal,
} from "@/lib/vehicle-ops";

export type VehicleOpsVehicle = {
  id: string;
  price: number;
  purchasePrice: number | null;
  inStoreName: boolean;
  hasSpareKey: boolean;
  hasManual: boolean;
};

function todayInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function Toggle({
  name,
  label,
  hint,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex min-h-[72px] items-start gap-3 border px-3 py-3 text-left transition ${
        checked
          ? "border-brand bg-brand/10"
          : "border-white/10 bg-ink hover:border-white/25"
      }`}
    >
      <input type="hidden" name={name} value={checked ? "on" : "off"} />
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${
          checked ? "border-brand bg-brand text-cream" : "border-white/20 text-transparent"
        }`}
      >
        <IconCheck className="h-3 w-3" />
      </span>
      <span>
        <span className="block font-display text-xs font-semibold uppercase tracking-wide text-cream">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
}

export function VehicleOpsPanel({
  vehicle,
  costs,
  documents,
}: {
  vehicle: VehicleOpsVehicle;
  costs: VehicleCost[];
  documents: VehicleDocument[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [inStoreName, setInStoreName] = useState(vehicle.inStoreName);
  const [hasSpareKey, setHasSpareKey] = useState(vehicle.hasSpareKey);
  const [hasManual, setHasManual] = useState(vehicle.hasManual);
  const [purchase, setPurchase] = useState(
    vehicle.purchasePrice != null
      ? formatNumberBR(Math.round(vehicle.purchasePrice))
      : "",
  );

  const [showCostForm, setShowCostForm] = useState(false);
  const [costAmount, setCostAmount] = useState("");
  const [costReceipt, setCostReceipt] = useState<{ url: string; name: string } | null>(
    null,
  );
  const [uploadingCost, setUploadingCost] = useState(false);

  const [showDocForm, setShowDocForm] = useState(false);
  const [docFile, setDocFile] = useState<{ url: string; name: string } | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const livePurchaseRaw = purchase.replace(/\D/g, "");
  const livePurchase = livePurchaseRaw ? Number(livePurchaseRaw) : null;
  const invested = investedTotal(livePurchase, costs);
  const margin = expectedMargin(vehicle.price, livePurchase, costs);
  const hasPurchase = livePurchase != null && livePurchase > 0;

  function refresh() {
    router.refresh();
  }

  function handleSaveOps(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateVehicleOps(vehicle.id, formData);
      if (result.ok) {
        toast.success(result.message);
        refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleAddCost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (costReceipt) {
      formData.set("receiptUrl", costReceipt.url);
      formData.set("receiptName", costReceipt.name);
    }
    startTransition(async () => {
      const result = await addVehicleCost(vehicle.id, formData);
      if (result.ok) {
        toast.success(result.message);
        form.reset();
        setCostAmount("");
        setCostReceipt(null);
        setShowCostForm(false);
        refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleAddDoc(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!docFile) {
      toast.error("Anexe o arquivo do documento.");
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("fileUrl", docFile.url);
    formData.set("fileName", docFile.name);
    startTransition(async () => {
      const result = await addVehicleDocument(vehicle.id, formData);
      if (result.ok) {
        toast.success(result.message);
        form.reset();
        setDocFile(null);
        setShowDocForm(false);
        refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  async function onReceiptChange(file: File | undefined) {
    if (!file) {
      setCostReceipt(null);
      return;
    }
    setUploadingCost(true);
    try {
      setCostReceipt(await uploadAdminFile(file, vehicle.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no comprovante.");
      setCostReceipt(null);
    } finally {
      setUploadingCost(false);
    }
  }

  async function onDocFileChange(file: File | undefined) {
    if (!file) {
      setDocFile(null);
      return;
    }
    setUploadingDoc(true);
    try {
      setDocFile(await uploadAdminFile(file, vehicle.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no documento.");
      setDocFile(null);
    } finally {
      setUploadingDoc(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSaveOps} className="space-y-5">
        <Card title="Checklist interno">
          <div className="grid gap-3 sm:grid-cols-3">
            <Toggle
              name="inStoreName"
              label="Em nome da loja"
              hint="Documento já transferido"
              checked={inStoreName}
              onChange={setInStoreName}
            />
            <Toggle
              name="hasSpareKey"
              label="Chave reserva"
              hint="Veículo tem chave extra"
              checked={hasSpareKey}
              onChange={setHasSpareKey}
            />
            <Toggle
              name="hasManual"
              label="Manual"
              hint="Manual do proprietário"
              checked={hasManual}
              onChange={setHasManual}
            />
          </div>
        </Card>

        <Card title="Compra e margem">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr] lg:items-end">
            <Field
              label="Preço de compra"
              hint="Uso interno — não aparece no site."
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
            <div className="grid grid-cols-3 gap-3">
              <MiniStat
                label="Investido"
                value={hasPurchase || costs.length > 0 ? formatCurrencyBRL(invested) : "—"}
              />
              <MiniStat label="Anunciado" value={formatCurrencyBRL(vehicle.price)} />
              <MiniStat
                label="Margem"
                value={
                  hasPurchase || costs.length > 0 ? formatCurrencyBRL(margin) : "—"
                }
                tone={
                  !hasPurchase && costs.length === 0
                    ? "muted"
                    : margin >= 0
                      ? "good"
                      : "bad"
                }
              />
            </div>
          </div>
          <div className="mt-4">
            <button type="submit" disabled={pending} className={btn.primary}>
              {pending ? "Salvando..." : "Salvar operação"}
            </button>
          </div>
        </Card>
      </form>

      <Card
        title="Custos"
        action={
          <button
            type="button"
            onClick={() => setShowCostForm((open) => !open)}
            className={btn.ghost}
          >
            <IconPlus className="h-4 w-4" />
            {showCostForm ? "Fechar" : "Adicionar"}
          </button>
        }
      >
        {showCostForm ? (
          <form
            onSubmit={handleAddCost}
            className="mb-5 grid gap-3 border border-white/10 bg-asphalt/40 p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Field label="Tipo" required>
              <select name="kind" className={inputClass} defaultValue="despachante">
                {VEHICLE_COST_KINDS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor" required>
              <input
                name="amount"
                inputMode="numeric"
                value={costAmount}
                onChange={(event) =>
                  setCostAmount(
                    formatNumberBR(
                      Number(event.target.value.replace(/\D/g, "") || 0),
                    ),
                  )
                }
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                name="incurredAt"
                defaultValue={todayInput()}
                className={inputClass}
              />
            </Field>
            <Field label="Descrição">
              <input
                name="description"
                placeholder="Opcional"
                className={inputClass}
                autoComplete="off"
              />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field
                label="Comprovante"
                hint="Opcional — PDF ou imagem."
              >
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className={`${inputClass} file:mr-3 file:border-0 file:bg-transparent file:text-xs file:text-muted`}
                  onChange={(event) =>
                    void onReceiptChange(event.target.files?.[0])
                  }
                />
                {uploadingCost ? (
                  <p className="mt-1 text-xs text-muted">Enviando comprovante…</p>
                ) : costReceipt ? (
                  <p className="mt-1 truncate text-xs text-emerald-300">
                    {costReceipt.name}
                  </p>
                ) : null}
              </Field>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={pending || uploadingCost}
                className={btn.primary}
              >
                Registrar custo
              </button>
            </div>
          </form>
        ) : null}

        {costs.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum custo extra. A compra fica no campo acima; aqui entram
            despachante, estética, laudo etc.
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
            {costs.map((cost) => (
              <li
                key={cost.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-cream">
                    {costKindLabel(cost.kind)}
                    {cost.description ? ` · ${cost.description}` : ""}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(cost.incurredAt)}
                    {cost.receiptUrl ? " · com comprovante" : ""}
                  </p>
                </div>
                <p className="font-display text-sm font-semibold text-cream">
                  {formatCurrencyBRL(cost.amount)}
                </p>
                {cost.receiptUrl ? (
                  <a
                    href={cost.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-muted transition hover:text-cream"
                    title={cost.receiptName || "Comprovante"}
                  >
                    <IconDownload className="h-4 w-4" />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteVehicleCost(vehicle.id, cost.id);
                      if (result.ok) {
                        toast.success(result.message);
                        refresh();
                      } else toast.error(result.message);
                    })
                  }
                  className="p-2 text-brand transition hover:text-cream"
                  aria-label="Remover custo"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Documentos"
        action={
          <button
            type="button"
            onClick={() => setShowDocForm((open) => !open)}
            className={btn.ghost}
          >
            <IconPlus className="h-4 w-4" />
            {showDocForm ? "Fechar" : "Adicionar"}
          </button>
        }
      >
        {showDocForm ? (
          <form
            onSubmit={handleAddDoc}
            className="mb-5 grid gap-3 border border-white/10 bg-asphalt/40 p-4 sm:grid-cols-2"
          >
            <Field label="Tipo" required>
              <select name="kind" className={inputClass} defaultValue="crlv">
                {VEHICLE_DOC_KINDS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nome" hint="Opcional">
              <input
                name="title"
                placeholder="Ex.: CRLV 2026"
                className={inputClass}
                autoComplete="off"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Arquivo" required hint="PDF ou imagem.">
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className={`${inputClass} file:mr-3 file:border-0 file:bg-transparent file:text-xs file:text-muted`}
                  onChange={(event) =>
                    void onDocFileChange(event.target.files?.[0])
                  }
                />
                {uploadingDoc ? (
                  <p className="mt-1 text-xs text-muted">Enviando arquivo…</p>
                ) : docFile ? (
                  <p className="mt-1 truncate text-xs text-emerald-300">
                    {docFile.name}
                  </p>
                ) : null}
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Observação">
                <input
                  name="notes"
                  placeholder="Opcional"
                  className={inputClass}
                />
              </Field>
            </div>
            <div>
              <button
                type="submit"
                disabled={pending || uploadingDoc}
                className={btn.primary}
              >
                Salvar documento
              </button>
            </div>
          </form>
        ) : null}

        {documents.length === 0 ? (
          <p className="text-sm text-muted">
            Nenhum arquivo ainda. CRLV, recibo, laudo e afins ficam só no painel.
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-cream">{doc.title}</p>
                  <p className="text-xs text-muted">
                    {docKindLabel(doc.kind)}
                    {doc.notes ? ` · ${doc.notes}` : ""}
                  </p>
                </div>
                <Badge tone="neutral">{docKindLabel(doc.kind)}</Badge>
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-muted transition hover:text-cream"
                  title={doc.fileName || "Abrir"}
                >
                  <IconDownload className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      const result = await deleteVehicleDocument(
                        vehicle.id,
                        doc.id,
                      );
                      if (result.ok) {
                        toast.success(result.message);
                        refresh();
                      } else toast.error(result.message);
                    })
                  }
                  className="p-2 text-brand transition hover:text-cream"
                  aria-label="Remover documento"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string;
  tone?: "muted" | "good" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-emerald-300"
      : tone === "bad"
        ? "text-brand"
        : "text-cream";
  return (
    <div className="min-w-0 overflow-hidden [container-type:inline-size] border border-white/10 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      <p
        title={value}
        className={`mt-1 truncate font-display font-semibold tabular-nums ${color} [font-size:clamp(0.7rem,11cqi,0.875rem)]`}
      >
        {value}
      </p>
    </div>
  );
}
