"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  IconCash,
  IconDownload,
  IconPlus,
  IconTrash,
} from "@/components/admin/icons";
import { IconWhatsApp } from "@/components/site/icons";
import { Badge, Card, EmptyState, Field, btn, inputClass } from "@/components/admin/ui";
import { createSale, deleteSale } from "@/app/admin/vendas/actions";
import {
  formatCurrencyBRL,
  formatNumberBR,
  formatPhoneBR,
  formatPlateDisplay,
  formatPlateInput,
} from "@/lib/format";

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
};

export type CustomerOption = { id: string; name: string; phone: string };

type SaleSource = "estoque" | "historica";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
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
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function customerPhoneDigits(customer: SaleRow["customer"]) {
  return customer?.phone?.replace(/\D/g, "") ?? "";
}

export function SalesManager({
  sales,
  vehicles,
  customers,
}: {
  sales: SaleRow[];
  vehicles: SellableVehicle[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<SaleSource>("estoque");
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [vehicleId, setVehicleId] = useState("");
  const [customerId, setCustomerId] = useState("novo");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [cancelTarget, setCancelTarget] = useState<SaleRow | null>(null);
  const [period, setPeriod] = useState<Period>("all");

  const isHistorical = source === "historica";
  const isNewCustomer = customerId === "" || customerId === "novo";

  const filteredSales = useMemo(
    () => sales.filter((sale) => matchesPeriod(new Date(sale.saleDate), period)),
    [sales, period],
  );

  const periodTotal = useMemo(
    () => filteredSales.reduce((sum, sale) => sum + sale.salePrice, 0),
    [filteredSales],
  );

  function selectVehicle(id: string) {
    setVehicleId(id);
    const vehicle = vehicles.find((item) => item.id === id);
    if (vehicle) setPrice(formatNumberBR(Math.round(vehicle.price)));
  }

  function resetForm() {
    setSource("estoque");
    setVehicleId("");
    setCustomerId("novo");
    setPrice("");
    setPhone("");
    setPlate("");
    setErrors({});
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const form = event.currentTarget;

    startTransition(async () => {
      const result = await createSale(formData);
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
        <Card title="Registrar venda">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="source" value={source} />

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
                  setErrors({});
                }}
                className={source === "historica" ? btn.primary : btn.outline}
              >
                Venda histórica
              </button>
            </div>
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
                      placeholder="Ex.: Volkswagen"
                      className={inputClass}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Modelo" required error={errors.model}>
                    <input
                      name="model"
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
                    disabled={vehicles.length === 0}
                  >
                    <option value="">
                      {vehicles.length === 0
                        ? "Nenhum veículo sem venda"
                        : "Selecione o veículo"}
                    </option>
                    {vehicles.map((vehicle) => (
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
                  isHistorical
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
                  key={`payment-${source}`}
                  name="paymentMethod"
                  className={inputClass}
                  defaultValue={isHistorical ? "Histórico" : ""}
                >
                  <option value="">
                    {isHistorical ? "Histórico (padrão)" : "Selecione"}
                  </option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </Field>

              {isNewCustomer ? (
                <>
                  <Field label="Nome do cliente" error={errors.customerName}>
                    <input
                      name="customerName"
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
                  defaultValue={todayInputValue()}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Observações">
              <textarea
                name="notes"
                rows={3}
                placeholder="Detalhes da negociação, entrada, troca, prazos..."
                className={`${inputClass} resize-y`}
              />
            </Field>

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <button type="submit" disabled={isPending} className={btn.primary}>
                {isPending ? "Registrando..." : "Registrar venda"}
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={btn.primary}
          >
            <IconPlus className="h-4 w-4" />
            Registrar venda
          </button>

          {sales.length > 0 ? (
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
                {filteredSales.length} venda(s)
                {period !== "all"
                  ? ` · ${formatCurrencyBRL(periodTotal)}`
                  : ""}
              </span>
              <button
                type="button"
                onClick={() => exportSalesCsv(filteredSales)}
                disabled={filteredSales.length === 0}
                className="inline-flex items-center gap-2 border border-white/15 px-3 py-2.5 text-xs text-cream transition hover:border-brand disabled:opacity-50 sm:ml-auto"
              >
                <IconDownload className="h-4 w-4" />
                Exportar CSV
              </button>
            </>
          ) : null}
        </div>
      )}

      {sales.length === 0 ? (
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
              return (
                <li key={sale.id} className="border border-white/10 bg-ink/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {sale.vehicle.historical ? (
                        <p className="font-display text-sm font-semibold text-cream">
                          {sale.vehicle.brand} {sale.vehicle.model}
                        </p>
                      ) : (
                        <Link
                          href={`/admin/veiculos/${sale.vehicle.id}`}
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
                    <p className="shrink-0 font-display text-base font-bold text-cream">
                      {formatCurrencyBRL(sale.salePrice)}
                    </p>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-muted">
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
                  </div>

                  <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                    <Badge tone="success">{sale.paymentMethod}</Badge>
                    {sale.vehicle.historical ? (
                      <Badge tone="neutral">Histórica</Badge>
                    ) : null}
                    {wa ? (
                      <a
                        href={`https://wa.me/55${wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto p-2 text-muted transition hover:text-cream"
                        aria-label="WhatsApp do cliente"
                      >
                        <IconWhatsApp className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="ml-auto" />
                    )}
                    <button
                      type="button"
                      onClick={() => setCancelTarget(sale)}
                      className="p-2 text-brand transition hover:text-cream"
                      aria-label="Cancelar venda"
                    >
                      <IconTrash className="h-4 w-4" />
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
                            href={`/admin/veiculos/${sale.vehicle.id}`}
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
