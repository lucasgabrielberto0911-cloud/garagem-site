"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { VehicleCost, VehicleDocument } from "@prisma/client";
import {
  addVehicleCost,
  addVehicleDocument,
  deleteVehicleCost,
  deleteVehicleDocument,
  updateVehicleOps,
} from "@/app/admin/veiculos/ops-actions";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  IconCheck,
  IconDownload,
  IconPlus,
  IconTrash,
} from "@/components/admin/icons";
import { AdminFileDrop } from "@/components/admin/AdminFileDrop";
import { Badge, Card, Field, btn, iconTap, inputClass } from "@/components/admin/ui";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { uploadAdminFile } from "@/lib/upload-admin-file";
import {
  VEHICLE_COST_KINDS,
  VEHICLE_DOC_KINDS,
  costListTitle,
  docKindLabel,
  docListTitle,
  expectedMargin,
  extrasTotal,
  hasCostBasis,
  investedTotal,
  isOtherKind,
  type VehicleCostKind,
  type VehicleDocKind,
} from "@/lib/vehicle-ops";

export type VehicleOpsVehicle = {
  id: string;
  price: number;
  salePrice: number | null;
  purchasePrice: number | null;
  inStoreName: boolean;
  hasSpareKey: boolean;
  hasManual: boolean;
};

type OpsDraft = {
  inStoreName: boolean;
  hasSpareKey: boolean;
  hasManual: boolean;
  purchase: string;
};

function todayInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
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
  const [opsPending, startOpsTransition] = useTransition();
  const [itemPending, startItemTransition] = useTransition();
  const [opsNote, setOpsNote] = useState("Salva ao tocar");
  const [inStoreName, setInStoreName] = useState(vehicle.inStoreName);
  const [hasSpareKey, setHasSpareKey] = useState(vehicle.hasSpareKey);
  const [hasManual, setHasManual] = useState(vehicle.hasManual);
  const [purchase, setPurchase] = useState(
    vehicle.purchasePrice != null
      ? formatNumberBR(Math.round(vehicle.purchasePrice))
      : "",
  );
  const draftRef = useRef<OpsDraft>({
    inStoreName: vehicle.inStoreName,
    hasSpareKey: vehicle.hasSpareKey,
    hasManual: vehicle.hasManual,
    purchase:
      vehicle.purchasePrice != null
        ? formatNumberBR(Math.round(vehicle.purchasePrice))
        : "",
  });

  const [showCostForm, setShowCostForm] = useState(false);
  const [costKind, setCostKind] = useState<VehicleCostKind>("despachante");
  const [costAmount, setCostAmount] = useState("");
  const [costReceipt, setCostReceipt] = useState<{ url: string; name: string } | null>(
    null,
  );
  const [uploadingCost, setUploadingCost] = useState(false);

  const [showDocForm, setShowDocForm] = useState(false);
  const [docKind, setDocKind] = useState<VehicleDocKind>("crlv");
  const [docFile, setDocFile] = useState<{ url: string; name: string } | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: "cost"; id: string; label: string }
    | { type: "doc"; id: string; label: string }
    | null
  >(null);

  useEffect(() => {
    const next: OpsDraft = {
      inStoreName: vehicle.inStoreName,
      hasSpareKey: vehicle.hasSpareKey,
      hasManual: vehicle.hasManual,
      purchase:
        vehicle.purchasePrice != null
          ? formatNumberBR(Math.round(vehicle.purchasePrice))
          : "",
    };
    draftRef.current = next;
    setInStoreName(next.inStoreName);
    setHasSpareKey(next.hasSpareKey);
    setHasManual(next.hasManual);
    setPurchase(next.purchase);
  }, [
    vehicle.inStoreName,
    vehicle.hasSpareKey,
    vehicle.hasManual,
    vehicle.purchasePrice,
  ]);

  const livePurchaseRaw = purchase.replace(/\D/g, "");
  const livePurchase = livePurchaseRaw ? Number(livePurchaseRaw) : null;
  const referencePrice = vehicle.salePrice ?? vehicle.price;
  const invested = investedTotal(livePurchase, costs);
  const margin = expectedMargin(referencePrice, livePurchase, costs);
  const extras = extrasTotal(costs);
  const hasBasis = hasCostBasis(livePurchase, costs);
  const sold = vehicle.salePrice != null;

  function refresh() {
    router.refresh();
  }

  function persistOps(patch: Partial<OpsDraft>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setInStoreName(next.inStoreName);
    setHasSpareKey(next.hasSpareKey);
    setHasManual(next.hasManual);
    setPurchase(next.purchase);

    const formData = new FormData();
    formData.set("inStoreName", next.inStoreName ? "on" : "off");
    formData.set("hasSpareKey", next.hasSpareKey ? "on" : "off");
    formData.set("hasManual", next.hasManual ? "on" : "off");
    formData.set("purchasePrice", next.purchase);

    startOpsTransition(async () => {
      const result = await updateVehicleOps(vehicle.id, formData);
      if (result.ok) {
        setOpsNote("Salvo");
        refresh();
      } else {
        setOpsNote("Erro ao salvar");
        toast.error(result.message);
      }
    });
  }

  function handleAddCost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (isOtherKind(costKind) && !String(formData.get("description") || "").trim()) {
      toast.error("Informe o nome do custo.");
      return;
    }
    if (costReceipt) {
      formData.set("receiptUrl", costReceipt.url);
      formData.set("receiptName", costReceipt.name);
    }
    startItemTransition(async () => {
      const result = await addVehicleCost(vehicle.id, formData);
      if (result.ok) {
        toast.success(result.message);
        form.reset();
        setCostAmount("");
        setCostKind("despachante");
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
    if (isOtherKind(docKind) && !String(formData.get("title") || "").trim()) {
      toast.error("Informe o nome do documento.");
      return;
    }
    formData.set("fileUrl", docFile.url);
    formData.set("fileName", docFile.name);
    startItemTransition(async () => {
      const result = await addVehicleDocument(vehicle.id, formData);
      if (result.ok) {
        toast.success(result.message);
        form.reset();
        setDocFile(null);
        setDocKind("crlv");
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
      <Card
        title="Checklist interno"
        action={
          <span className="text-[11px] text-muted">
            {opsPending ? "Salvando…" : opsNote}
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Toggle
            label="Em nome da loja"
            hint="Documento já transferido"
            checked={inStoreName}
            onChange={(next) => persistOps({ inStoreName: next })}
          />
          <Toggle
            label="Chave reserva"
            hint="Veículo tem chave extra"
            checked={hasSpareKey}
            onChange={(next) => persistOps({ hasSpareKey: next })}
          />
          <Toggle
            label="Manual"
            hint="Manual do proprietário"
            checked={hasManual}
            onChange={(next) => persistOps({ hasManual: next })}
          />
        </div>
      </Card>

      <Card title="Compra e margem">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_1fr] lg:items-end">
          <Field
            label="Preço de compra"
            hint="Salva ao sair do campo. Não aparece no site."
          >
            <input
              inputMode="numeric"
              value={purchase}
              onChange={(event) => {
                const next = formatNumberBR(
                  Number(event.target.value.replace(/\D/g, "") || 0),
                );
                setPurchase(next);
                draftRef.current = { ...draftRef.current, purchase: next };
              }}
              onBlur={() => persistOps({ purchase })}
              placeholder="0"
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <MiniStat
              label="Investido"
              value={hasBasis ? formatCurrencyBRL(invested) : "—"}
            />
            <MiniStat
              label={sold ? "Vendido" : "Anunciado"}
              value={formatCurrencyBRL(referencePrice)}
            />
            <MiniStat
              label={sold ? "Lucro" : "Margem"}
              value={hasBasis ? formatCurrencyBRL(margin) : "—"}
              tone={!hasBasis ? "muted" : margin >= 0 ? "good" : "bad"}
            />
          </div>
        </div>
      </Card>

      <Card
        title={extras > 0 ? `Custos · ${formatCurrencyBRL(extras)}` : "Custos"}
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
            onDragOver={(event) => {
              if (Array.from(event.dataTransfer.types).includes("Files")) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              if (!Array.from(event.dataTransfer.types).includes("Files")) return;
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void onReceiptChange(file);
            }}
            className="mb-5 grid gap-3 border border-white/10 bg-asphalt/40 p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <Field label="Tipo" required>
              <select
                name="kind"
                className={inputClass}
                value={costKind}
                onChange={(event) =>
                  setCostKind(event.target.value as VehicleCostKind)
                }
              >
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
            {isOtherKind(costKind) ? (
              <Field
                label="Nome do custo"
                hint="Ex.: IPVA, chaveiro."
                required
              >
                <input
                  name="description"
                  placeholder="Como deve aparecer na lista"
                  className={inputClass}
                  autoComplete="off"
                  required
                />
              </Field>
            ) : (
              <Field label="Observação">
                <input
                  name="description"
                  placeholder="Opcional"
                  className={inputClass}
                  autoComplete="off"
                />
              </Field>
            )}
            <div className="sm:col-span-2 lg:col-span-3">
              <AdminFileDrop
                label="Comprovante"
                hint="Opcional — PDF ou imagem. Arraste ou clique."
                fileName={costReceipt?.name}
                uploading={uploadingCost}
                disabled={itemPending}
                onFile={(file) => void onReceiptChange(file)}
                onClear={() => setCostReceipt(null)}
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={itemPending || uploadingCost}
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
                    {costListTitle(cost.kind, cost.description)}
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
                    className={iconTap}
                    title={cost.receiptName || "Comprovante"}
                  >
                    <IconDownload className="h-4 w-4" />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setPendingDelete({
                      type: "cost",
                      id: cost.id,
                      label: costListTitle(cost.kind, cost.description),
                    })
                  }
                  className={`${iconTap} text-brand hover:text-cream`}
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
        title={
          documents.length > 0
            ? `Documentos · ${documents.length}`
            : "Documentos"
        }
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
            onDragOver={(event) => {
              if (Array.from(event.dataTransfer.types).includes("Files")) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              if (!Array.from(event.dataTransfer.types).includes("Files")) return;
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void onDocFileChange(file);
            }}
            className="mb-5 grid gap-3 border border-white/10 bg-asphalt/40 p-4 sm:grid-cols-2"
          >
            <Field label="Tipo" required>
              <select
                name="kind"
                className={inputClass}
                value={docKind}
                onChange={(event) =>
                  setDocKind(event.target.value as VehicleDocKind)
                }
              >
                {VEHICLE_DOC_KINDS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>
            {isOtherKind(docKind) ? (
              <Field
                label="Nome do documento"
                hint="Ex.: contrato, boleto, termo de garantia."
                required
              >
                <input
                  name="title"
                  placeholder="Como deve aparecer na lista"
                  className={inputClass}
                  autoComplete="off"
                  required
                />
              </Field>
            ) : (
              <Field label="Nome" hint="Opcional">
                <input
                  name="title"
                  placeholder="Ex.: CRLV 2026"
                  className={inputClass}
                  autoComplete="off"
                />
              </Field>
            )}
            <div className="sm:col-span-2">
              <AdminFileDrop
                label="Arquivo"
                hint="PDF ou imagem. Arraste ou clique."
                required
                fileName={docFile?.name}
                uploading={uploadingDoc}
                disabled={itemPending}
                onFile={(file) => void onDocFileChange(file)}
                onClear={() => setDocFile(null)}
              />
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
                disabled={itemPending || uploadingDoc}
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
                  <p className="text-sm text-cream">
                    {docListTitle(doc.kind, doc.title)}
                  </p>
                  {doc.notes || !isOtherKind(doc.kind) ? (
                    <p className="text-xs text-muted">
                      {isOtherKind(doc.kind)
                        ? doc.notes
                        : [docKindLabel(doc.kind), doc.notes]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                  ) : null}
                </div>
                {isOtherKind(doc.kind) ? null : (
                  <Badge tone="neutral">{docKindLabel(doc.kind)}</Badge>
                )}
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={iconTap}
                  title={doc.fileName || "Abrir"}
                >
                  <IconDownload className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() =>
                    setPendingDelete({
                      type: "doc",
                      id: doc.id,
                      label: docListTitle(doc.kind, doc.title),
                    })
                  }
                  className={`${iconTap} text-brand hover:text-cream`}
                  aria-label="Remover documento"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete != null}
        title={
          pendingDelete?.type === "doc"
            ? "Remover documento?"
            : "Remover custo?"
        }
        description={
          pendingDelete
            ? `${pendingDelete.label} será apagado. Essa ação não tem volta.`
            : undefined
        }
        confirmLabel="Remover"
        loading={itemPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          const target = pendingDelete;
          startItemTransition(async () => {
            const result =
              target.type === "cost"
                ? await deleteVehicleCost(vehicle.id, target.id)
                : await deleteVehicleDocument(vehicle.id, target.id);
            if (result.ok) {
              toast.success(result.message);
              setPendingDelete(null);
              refresh();
            } else {
              toast.error(result.message);
            }
          });
        }}
      />
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
