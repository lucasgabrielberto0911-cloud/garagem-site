"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import {
  IconCash,
  IconDownload,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@/components/admin/icons";
import { IconWhatsApp } from "@/components/site/icons";
import { Badge, Card, EmptyState, Field, btn, inputClass, mobileActionCell } from "@/components/admin/ui";
import { createSale, deleteSale, updateSale } from "@/app/admin/vendas/actions";
import {
  formatCurrencyBRL,
  formatNumberBR,
  formatPhoneBR,
  formatPlateDisplay,
  formatPlateInput,
} from "@/lib/format";
import {
  expectedMargin,
  hasCostBasis,
  investedTotal,
} from "@/lib/vehicle-ops";

export const PAYMENT_METHODS = [
  "À vista (Pix/dinheiro)",
  "Financiamento",
  "Consórcio",
  "Cartão",
  "Troca + valor",
  "Histórico",
  "Outro",
] as const;

export type SaleRow = {
  id: string;
  salePrice: number;
  paymentMethod: string;
  saleDate: Date;
  notes: string | null;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    yearModel: number;
    plate: string | null;
    historical: boolean;
    purchasePrice: number | null;
    costs: Array<{ amount: number }>;
  };
  customer: { id: string; name: string; phone: string } | null;
};

export type SellableVehicle = {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  yearModel: number;
  price: number;
  status: string;
  purchasePrice: number | null;
  costs: Array<{ amount: number }>;
};

export type CustomerOption = { id: string; name: string; phone: string };

type SaleSource = "estoque" | "historica";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function saleFinance(
  salePrice: number,
  purchasePrice: number | null,
  costs: Array<{ amount: number }>,
) {
  if (!hasCostBasis(purchasePrice, costs)) return null;
  const margin = expectedMargin(salePrice, purchasePrice, costs);
  return {
    invested: investedTotal(purchasePrice, costs),
    margin,
  };
}

const PERIODS = [
  { value: "all", label: "Todo o período" },
  { value: "month", label: "Mês atual" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "year", label: "Ano atual" },
] as const;

type Period = (typeof PERIODS)[number]["value"];

function matchesPeriod(date: Date, period: Period) {
  if (period === "all") return true;
  const now = new Date();

  if (period === "month") {
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }
  if (period === "year") return date.getFullYear() === now.getFullYear();

  const days = Number(period);
  return now.getTime() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

function exportSalesCsv(sales: SaleRow[]) {
  const header = [
    "Data",
    "Veículo",
    "Ano",
    "Placa",
    "Cliente",
    "Telefone",
    "Pagamento",
    "Valor",
    "Lucro",
    "Tipo",
    "Observações",
  ];
  const rows = sales.map((sale) => [
    formatDate(sale.saleDate),
    `${sale.vehicle.brand} ${sale.vehicle.model}`,
    String(sale.vehicle.yearModel),
    sale.vehicle.plate ? formatPlateDisplay(sale.vehicle.plate) : "",
    sale.customer?.name ?? "",
    sale.customer?.phone ? formatPhoneBR(sale.customer.phone) : "",
    sale.paymentMethod,
    String(sale.salePrice),
    hasCostBasis(sale.vehicle.purchasePrice, sale.vehicle.costs)
      ? String(
          expectedMargin(
            sale.salePrice,
            sale.vehicle.purchasePrice,
            sale.vehicle.costs,
          ),
        )
      : "",
    sale.vehicle.historical ? "Histórica" : "Estoque",
    (sale.notes ?? "").replace(/\s+/g, " "),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `vendas-garagem-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function todayInputValue() {
  return dateInputFrom(new Date());
}

function dateInputFrom(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function customerPhoneDigits(customer: SaleRow["customer"]) {
  return customer?.phone?.replace(/\D/g, "") ?? "";
}

function hydrateSale(sale: SaleRow): SaleRow {
  return {
    ...sale,
    saleDate: new Date(sale.saleDate),
  };
}

export function SalesManager({
  sales,
  salesTotal,
  pageSize,
  vehicles,
  customers,
}: {
  sales: SaleRow[];
  salesTotal: number;
  pageSize: number;
  vehicles: SellableVehicle[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(() => sales.map(hydrateSale));
  const [total, setTotal] = useState(salesTotal);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [source, setSource] = useState<SaleSource>("estoque");
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [vehicleId, setVehicleId] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [yearModel, setYearModel] = useState("");
  const [customerId, setCustomerId] = useState("novo");
  const [customerName, setCustomerName] = useState("");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [saleDate, setSaleDate] = useState(todayInputValue());
  const [notes, setNotes] = useState("");
  const [cancelTarget, setCancelTarget] = useState<SaleRow | null>(null);
  const [period, setPeriod] = useState<Period>("all");

  const isEditing = editingId !== null;
  const isHistorical = source === "historica";
  const isNewCustomer = customerId === "" || customerId === "novo";
  const editingSale = isEditing
    ? rows.find((sale) => sale.id === editingId) ?? null
    : null;

  const stockOptions = useMemo(() => {
    if (!editingSale || editingSale.vehicle.historical) return vehicles;
    if (vehicles.some((item) => item.id === editingSale.vehicle.id)) {
      return vehicles;
    }
    return [
      {
        id: editingSale.vehicle.id,
        brand: editingSale.vehicle.brand,
        model: editingSale.vehicle.model,
        version: null,
        yearModel: editingSale.vehicle.yearModel,
        price: editingSale.salePrice,
        status: "vendido",
        purchasePrice: editingSale.vehicle.purchasePrice,
        costs: editingSale.vehicle.costs ?? [],
      },
      ...vehicles,
    ];
  }, [vehicles, editingSale]);

  const filteredSales = useMemo(
    () => rows.filter((sale) => matchesPeriod(new Date(sale.saleDate), period)),
    [rows, period],
  );

  const hasMore = rows.length < total;

  async function loadMoreSales() {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const nextPage = page + 1;
      const response = await fetch(
        `/api/admin/vendas?page=${nextPage}&pageSize=${pageSize}`,
      );
      if (!response.ok) throw new Error("fetch");
      const data = (await response.json()) as {
        sales?: SaleRow[];
        total?: number;
      };
      const incoming = (data.sales ?? []).map(hydrateSale);
      setTotal(data.total ?? total);
      setRows((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...incoming.filter((item) => !seen.has(item.id))];
      });
      setPage(nextPage);
    } catch {
      setLoadError(true);
      toast.error("Não foi possível carregar mais vendas.");
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setRows(sales.map(hydrateSale));
    setTotal(salesTotal);
    setPage(1);
  }, [sales, salesTotal]);

  const periodTotal = useMemo(
    () => filteredSales.reduce((sum, sale) => sum + sale.salePrice, 0),
    [filteredSales],
  );

  const selectedVehicle = stockOptions.find((item) => item.id === vehicleId);
  const liveSalePrice = Number(price.replace(/\D/g, "")) || 0;
  const liveFinance = !isHistorical
    ? selectedVehicle
      ? saleFinance(
          liveSalePrice || selectedVehicle.price,
          selectedVehicle.purchasePrice,
          selectedVehicle.costs,
        )
      : null
    : editingSale
      ? saleFinance(
          liveSalePrice || editingSale.salePrice,
          editingSale.vehicle.purchasePrice,
          editingSale.vehicle.costs,
        )
      : null;

  function selectVehicle(id: string) {
    setVehicleId(id);
    const vehicle = vehicles.find((item) => item.id === id);
    if (vehicle) setPrice(formatNumberBR(Math.round(vehicle.price)));
  }

  function resetForm() {
    setEditingId(null);
    setSource("estoque");
    setVehicleId("");
    setBrand("");
    setModel("");
    setYearModel("");
    setCustomerId("novo");
    setCustomerName("");
    setPrice("");
    setPhone("");
    setPlate("");
    setPaymentMethod("");
    setSaleDate(todayInputValue());
    setNotes("");
    setErrors({});
  }

  function startEdit(sale: SaleRow) {
    setOpen(true);
    setEditingId(sale.id);
    setSource(sale.vehicle.historical ? "historica" : "estoque");
    setVehicleId(sale.vehicle.id);
    setBrand(sale.vehicle.brand);
    setModel(sale.vehicle.model);
    setYearModel(
      sale.vehicle.yearModel > 0 ? String(sale.vehicle.yearModel) : "",
    );
    setPlate(
      sale.vehicle.plate ? formatPlateDisplay(sale.vehicle.plate) : "",
    );
    setPrice(formatNumberBR(Math.round(sale.salePrice)));
    setCustomerId(sale.customer?.id ?? "novo");
    setCustomerName(
      sale.customer && sale.customer.name !== "Não informado"
        ? sale.customer.name
        : "",
    );
    setPhone(
      sale.customer?.phone ? formatPhoneBR(sale.customer.phone) : "",
    );
    setPaymentMethod(sale.paymentMethod);
    setSaleDate(dateInputFrom(new Date(sale.saleDate)));
    setNotes(sale.notes ?? "");
    setErrors({});
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const form = event.currentTarget;

    startTransition(async () => {
      const result = isEditing
        ? await updateSale(formData)
        : await createSale(formData);
      setErrors(result.fieldErrors ?? {});

      if (result.ok) {
        toast.success(result.message);
        form.reset();
        resetForm();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleCancelSale() {
    if (!cancelTarget) return;
    const target = cancelTarget;
    startTransition(async () => {
      const result = await deleteSale(target.id);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setCancelTarget(null);
    });
  }

  return (
    <div className="space-y-5">
      {open ? (
        <Card title={isEditing ? "Editar venda" : "Registrar venda"}>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="source" value={source} />
            {isEditing ? (
              <input type="hidden" name="saleId" value={editingId} />
            ) : null}

            {!isEditing ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSource("estoque");
                    setErrors({});
                  }}
                  className={source === "estoque" ? btn.primary : btn.outline}
                >
                  Do estoque
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSource("historica");
                    setVehicleId("");
                    if (!paymentMethod) setPaymentMethod("Histórico");
                    setErrors({});
                  }}
                  className={source === "historica" ? btn.primary : btn.outline}
                >
                  Venda histórica
                </button>
              </div>
            ) : (
              <p className="text-xs uppercase tracking-wider text-muted">
                {isHistorical ? "Venda histórica" : "Venda do estoque"}
              </p>
            )}
            <p className="text-xs text-muted">
              {isHistorical
                ? "Para negócios feitos antes do site: informe carro, placa e valor. Cliente é opcional."
                : "Liga a venda a um veículo do estoque. Cliente é opcional."}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {isHistorical ? (
                <>
                  <Field label="Marca" required error={errors.brand}>
                    <input
                      name="brand"
                      value={brand}
                      onChange={(event) => setBrand(event.target.value)}
                      placeholder="Ex.: Volkswagen"
                      className={inputClass}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Modelo" required error={errors.model}>
                    <input
                      name="model"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      placeholder="Ex.: Gol"
                      className={inputClass}
                      autoComplete="off"
                    />
                  </Field>
                  <Field
                    label="Placa"
                    required
                    error={errors.plate}
                    hint="Uso interno — não aparece no site."
                  >
                    <input
                      name="plate"
                      value={plate}
                      onChange={(event) =>
                        setPlate(formatPlateInput(event.target.value))
                      }
                      placeholder="ABC1D23"
                      className={inputClass}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Ano modelo" error={errors.yearModel}>
                    <input
                      name="yearModel"
                      inputMode="numeric"
                      value={yearModel}
                      onChange={(event) => setYearModel(event.target.value)}
                      placeholder="Ex.: 2019"
                      className={inputClass}
                    />
                  </Field>
                </>
              ) : (
                <Field label="Veículo vendido" required error={errors.vehicleId}>
                  <select
                    name="vehicleId"
                    value={vehicleId}
                    onChange={(event) => selectVehicle(event.target.value)}
                    className={inputClass}
                    disabled={stockOptions.length === 0}
                  >
                    <option value="">
                      {stockOptions.length === 0
                        ? "Nenhum veículo sem venda"
                        : "Selecione o veículo"}
                    </option>
                    {stockOptions.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.brand} {vehicle.model}
                        {vehicle.version ? ` ${vehicle.version}` : ""} ·{" "}
                        {vehicle.yearModel} · {formatCurrencyBRL(vehicle.price)}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field
                label="Valor da venda (R$)"
                required
                error={errors.salePrice}
                hint={
                  liveFinance
                    ? `Investido ${formatCurrencyBRL(liveFinance.invested)} · ${liveFinance.margin >= 0 ? "lucro" : "prejuízo"} ${formatCurrencyBRL(liveFinance.margin)}`
                    : isHistorical
                      ? "Valor pelo qual o veículo foi vendido."
                      : "Preenchido com o preço do anúncio; ajuste se houve desconto."
                }
              >
                <input
                  name="salePrice"
                  inputMode="numeric"
                  value={price}
                  onChange={(event) =>
                    setPrice(
                      formatNumberBR(
                        Number(event.target.value.replace(/\D/g, "") || 0),
                      ),
                    )
                  }
                  placeholder="0"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Cliente"
                hint="Opcional — deixe em novo cliente sem preencher nome."
              >
                <select
                  name="customerId"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className={inputClass}
                >
                  <option value="novo">Sem cliente / novo</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} · {formatPhoneBR(customer.phone)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Forma de pagamento"
                required={!isHistorical}
                error={errors.paymentMethod}
                hint={
                  isHistorical
                    ? "Opcional — se vazio, fica como Histórico."
                    : undefined
                }
              >
                <select
                  key={`payment-${source}-${editingId ?? "new"}`}
                  name="paymentMethod"
                  className={inputClass}
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="">
                    {isHistorical ? "Histórico (padrão)" : "Selecione"}
                  </option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                  {paymentMethod &&
                  !(PAYMENT_METHODS as readonly string[]).includes(
                    paymentMethod,
                  ) ? (
                    <option value={paymentMethod}>{paymentMethod}</option>
                  ) : null}
                </select>
              </Field>

              {isNewCustomer ? (
                <>
                  <Field label="Nome do cliente" error={errors.customerName}>
                    <input
                      name="customerName"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Opcional"
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Telefone do cliente"
                    error={errors.customerPhone}
                  >
                    <input
                      name="customerPhone"
                      inputMode="tel"
                      value={phone}
                      onChange={(event) =>
                        setPhone(formatPhoneBR(event.target.value))
                      }
                      placeholder="Opcional"
                      className={inputClass}
                    />
                  </Field>
                </>
              ) : null}

              <Field label="Data da venda" error={errors.saleDate}>
                <input
                  type="date"
                  name="saleDate"
                  value={saleDate}
                  onChange={(event) => setSaleDate(event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Observações">
              <textarea
                name="notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Detalhes da negociação, entrada, troca, prazos..."
                className={`${inputClass} resize-y`}
              />
            </Field>

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <button type="submit" disabled={isPending} className={btn.primary}>
                {isPending
                  ? isEditing
                    ? "Salvando..."
                    : "Registrando..."
                  : isEditing
                    ? "Salvar alterações"
                    : "Registrar venda"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className={btn.outline}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${btn.primary} w-full sm:w-auto`}
          >
            <IconPlus className="h-4 w-4" />
            Registrar venda
          </button>

          {rows.length > 0 ? (
            <>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as Period)}
                className={`${inputClass} sm:w-48`}
                aria-label="Filtrar por período"
              >
                {PERIODS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted">
                {filteredSales.length}
                {period === "all" && total > rows.length
                  ? ` de ${total}`
                  : ""}{" "}
                venda(s)
                {period !== "all"
                  ? ` · ${formatCurrencyBRL(periodTotal)}`
                  : ""}
              </span>
              <button
                type="button"
                onClick={async () => {
                  let source = rows;
                  if (hasMore) {
                    try {
                      const response = await fetch(
                        `/api/admin/vendas?page=1&pageSize=500`,
                      );
                      if (response.ok) {
                        const data = (await response.json()) as {
                          sales?: SaleRow[];
                        };
                        source = (data.sales ?? []).map(hydrateSale);
                      }
                    } catch {
                      toast.error("Exportando só as vendas já carregadas.");
                    }
                  }
                  exportSalesCsv(
                    source.filter((sale) =>
                      matchesPeriod(new Date(sale.saleDate), period),
                    ),
                  );
                }}
                disabled={filteredSales.length === 0}
                className={`${btn.outline} w-full sm:ml-auto sm:w-auto`}
              >
                <IconDownload className="h-4 w-4" />
                Exportar CSV
              </button>
            </>
          ) : null}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<IconCash className="h-12 w-12" />}
          title="Nenhuma venda registrada"
          description="Registre vendas do estoque ou históricas (antes do site) para acompanhar faturamento."
        />
      ) : filteredSales.length === 0 ? (
        <EmptyState
          icon={<IconCash className="h-12 w-12" />}
          title="Nenhuma venda neste período"
          description="Amplie o filtro de datas para ver o histórico completo."
        />
      ) : (
        <>
          <ul className="space-y-3 lg:hidden">
            {filteredSales.map((sale) => {
              const wa = customerPhoneDigits(sale.customer);
              const finance = saleFinance(
                sale.salePrice,
                sale.vehicle.purchasePrice,
                sale.vehicle.costs,
              );
              return (
                <li key={sale.id} className="overflow-hidden border border-white/10 bg-ink/50">
                  <div className="flex items-start justify-between gap-3 p-4 pb-3">
                    <div className="min-w-0">
                      {sale.vehicle.historical ? (
                        <p className="font-display text-sm font-semibold text-cream">
                          {sale.vehicle.brand} {sale.vehicle.model}
                        </p>
                      ) : (
                        <Link
                          href={`/admin/veiculos/${sale.vehicle.id}?view=operacao`}
                          className="font-display text-sm font-semibold text-cream"
                        >
                          {sale.vehicle.brand} {sale.vehicle.model}
                        </Link>
                      )}
                      <p className="text-xs text-muted">
                        {sale.vehicle.yearModel > 0
                          ? `${sale.vehicle.yearModel} · `
                          : ""}
                        {formatDate(sale.saleDate)}
                        {sale.vehicle.plate
                          ? ` · ${formatPlateDisplay(sale.vehicle.plate)}`
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-base font-bold text-cream">
                        {formatCurrencyBRL(sale.salePrice)}
                      </p>
                      {finance ? (
                        <p
                          className={`text-[11px] ${
                            finance.margin >= 0 ? "text-emerald-300" : "text-brand"
                          }`}
                        >
                          {formatCurrencyBRL(finance.margin)}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-1 px-4 pb-3 text-xs text-muted">
                    <p>
                      Cliente:{" "}
                      <span className="text-cream">
                        {sale.customer?.name ?? "Não informado"}
                      </span>
                    </p>
                    {sale.customer?.phone ? (
                      <p>{formatPhoneBR(sale.customer.phone)}</p>
                    ) : null}
                    {sale.notes ? <p className="italic">{sale.notes}</p> : null}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Badge tone="success">{sale.paymentMethod}</Badge>
                      {sale.vehicle.historical ? (
                        <Badge tone="neutral">Histórica</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 border-t border-white/10">
                    {wa ? (
                      <a
                        href={`https://wa.me/55${wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={mobileActionCell}
                        aria-label="WhatsApp do cliente"
                      >
                        <IconWhatsApp className="h-4 w-4" />
                        WhatsApp
                      </a>
                    ) : (
                      <span className={`${mobileActionCell} opacity-30`}>
                        <IconWhatsApp className="h-4 w-4" />
                        WhatsApp
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(sale)}
                      className={`${mobileActionCell} border-l border-white/10`}
                      aria-label="Editar venda"
                    >
                      <IconPencil className="h-4 w-4" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setCancelTarget(sale)}
                      className={`${mobileActionCell} border-l border-white/10 text-brand`}
                      aria-label="Cancelar venda"
                    >
                      <IconTrash className="h-4 w-4" />
                      Excluir
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto border border-white/10 lg:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-ink text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Veículo</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Pagamento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => {
                  const wa = customerPhoneDigits(sale.customer);
                  const finance = saleFinance(
                    sale.salePrice,
                    sale.vehicle.purchasePrice,
                    sale.vehicle.costs,
                  );
                  return (
                    <tr
                      key={sale.id}
                      className="border-t border-white/10 transition hover:bg-white/[0.04]"
                    >
                      <td className="px-4 py-3 text-muted">
                        {formatDate(sale.saleDate)}
                      </td>
                      <td className="px-4 py-3">
                        {sale.vehicle.historical ? (
                          <p className="font-medium text-cream">
                            {sale.vehicle.brand} {sale.vehicle.model}
                          </p>
                        ) : (
                          <Link
                            href={`/admin/veiculos/${sale.vehicle.id}?view=operacao`}
                            className="font-medium text-cream transition hover:text-brand"
                          >
                            {sale.vehicle.brand} {sale.vehicle.model}
                          </Link>
                        )}
                        <p className="text-xs text-muted">
                          {sale.vehicle.yearModel > 0
                            ? `${sale.vehicle.yearModel}`
                            : "—"}
                          {sale.vehicle.plate
                            ? ` · ${formatPlateDisplay(sale.vehicle.plate)}`
                            : ""}
                          {sale.vehicle.historical ? " · Histórica" : ""}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {sale.customer ? (
                          <>
                            <Link
                              href="/admin/clientes"
                              className="font-medium text-cream transition hover:text-brand"
                            >
                              {sale.customer.name}
                            </Link>
                            {sale.customer.phone ? (
                              <p className="text-xs text-muted">
                                {formatPhoneBR(sale.customer.phone)}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-muted">Não informado</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="success">{sale.paymentMethod}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatCurrencyBRL(sale.salePrice)}
                        {finance ? (
                          <p
                            className={`text-[11px] font-normal ${
                              finance.margin >= 0
                                ? "text-emerald-300"
                                : "text-brand"
                            }`}
                          >
                            {formatCurrencyBRL(finance.margin)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {wa ? (
                            <a
                              href={`https://wa.me/55${wa}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-muted transition hover:text-cream"
                              aria-label="WhatsApp do cliente"
                              title="WhatsApp do cliente"
                            >
                              <IconWhatsApp className="h-4 w-4" />
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => startEdit(sale)}
                            className="p-2 text-muted transition hover:text-cream"
                            aria-label="Editar venda"
                            title="Editar venda"
                          >
                            <IconPencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancelTarget(sale)}
                            className="p-2 text-brand transition hover:text-cream"
                            aria-label="Cancelar venda"
                            title="Cancelar venda"
                          >
                            <IconTrash className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore ? (
            <InfiniteSentinel onVisible={() => void loadMoreSales()} disabled={loadingMore || loadError}>
              {loadingMore ? (
                <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand border-r-transparent"
                    aria-hidden="true"
                  />
                  Carregando mais vendas…
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void loadMoreSales()}
                  className="min-h-[44px] border border-white/15 px-4 text-xs uppercase tracking-wider text-cream transition hover:border-brand"
                >
                  Carregar mais
                </button>
              )}
            </InfiniteSentinel>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancelar venda"
        description={
          cancelTarget
            ? cancelTarget.vehicle.historical
              ? `A venda histórica de ${cancelTarget.vehicle.brand} ${cancelTarget.vehicle.model} será apagada.`
              : `A venda de ${cancelTarget.vehicle.brand} ${cancelTarget.vehicle.model} será apagada e o veículo volta para o estoque como disponível.`
            : undefined
        }
        confirmLabel="Cancelar venda"
        danger
        loading={isPending}
        onCancel={() => setCancelTarget(null)}
        onConfirm={handleCancelSale}
      />
    </div>
  );
}
