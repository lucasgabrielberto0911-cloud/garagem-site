"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { IconCash, IconPlus, IconTrash } from "@/components/admin/icons";
import { IconWhatsApp } from "@/components/site/icons";
import { Badge, Card, EmptyState, Field, btn, inputClass } from "@/components/admin/ui";
import { createSale, deleteSale } from "@/app/admin/vendas/actions";
import { formatCurrencyBRL, formatNumberBR, formatPhoneBR } from "@/lib/format";

export const PAYMENT_METHODS = [
  "À vista (Pix/dinheiro)",
  "Financiamento",
  "Consórcio",
  "Cartão",
  "Troca + valor",
  "Outro",
] as const;

export type SaleRow = {
  id: string;
  salePrice: number;
  paymentMethod: string;
  saleDate: Date;
  notes: string | null;
  vehicle: { id: string; brand: string; model: string; yearModel: number };
  customer: { id: string; name: string; phone: string };
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
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
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [vehicleId, setVehicleId] = useState("");
  const [customerId, setCustomerId] = useState("novo");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [cancelTarget, setCancelTarget] = useState<SaleRow | null>(null);

  const isNewCustomer = customerId === "" || customerId === "novo";

  function selectVehicle(id: string) {
    setVehicleId(id);
    const vehicle = vehicles.find((item) => item.id === id);
    if (vehicle) setPrice(formatNumberBR(Math.round(vehicle.price)));
  }

  function resetForm() {
    setVehicleId("");
    setCustomerId("novo");
    setPrice("");
    setPhone("");
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
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Veículo vendido" required error={errors.vehicleId}>
                <select
                  name="vehicleId"
                  value={vehicleId}
                  onChange={(event) => selectVehicle(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione o veículo</option>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.brand} {vehicle.model}
                      {vehicle.version ? ` ${vehicle.version}` : ""} ·{" "}
                      {vehicle.yearModel} · {formatCurrencyBRL(vehicle.price)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Valor da venda (R$)"
                required
                error={errors.salePrice}
                hint="Preenchido com o preço do anúncio; ajuste se houve desconto."
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

              <Field label="Cliente" required>
                <select
                  name="customerId"
                  value={customerId}
                  onChange={(event) => setCustomerId(event.target.value)}
                  className={inputClass}
                >
                  <option value="novo">+ Novo cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} · {formatPhoneBR(customer.phone)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Forma de pagamento" required error={errors.paymentMethod}>
                <select name="paymentMethod" className={inputClass} defaultValue="">
                  <option value="">Selecione</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </Field>

              {isNewCustomer ? (
                <>
                  <Field label="Nome do cliente" required error={errors.customerName}>
                    <input
                      name="customerName"
                      placeholder="Nome completo"
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="Telefone do cliente"
                    required
                    error={errors.customerPhone}
                  >
                    <input
                      name="customerPhone"
                      inputMode="tel"
                      value={phone}
                      onChange={(event) => setPhone(formatPhoneBR(event.target.value))}
                      placeholder="(00) 00000-0000"
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
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={vehicles.length === 0}
          className={btn.primary}
          title={
            vehicles.length === 0
              ? "Cadastre um veículo disponível para registrar a venda"
              : undefined
          }
        >
          <IconPlus className="h-4 w-4" />
          Registrar venda
        </button>
      )}

      {sales.length === 0 ? (
        <EmptyState
          icon={<IconCash className="h-12 w-12" />}
          title="Nenhuma venda registrada"
          description="Registre as vendas para acompanhar faturamento, ticket médio e o histórico de cada cliente."
        />
      ) : (
        <>
          {/* Mobile: cards. */}
          <ul className="space-y-3 lg:hidden">
            {sales.map((sale) => (
              <li key={sale.id} className="border border-white/10 bg-ink/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/veiculos/${sale.vehicle.id}`}
                      className="font-display text-sm font-semibold text-cream"
                    >
                      {sale.vehicle.brand} {sale.vehicle.model}
                    </Link>
                    <p className="text-xs text-muted">
                      {sale.vehicle.yearModel} · {formatDate(sale.saleDate)}
                    </p>
                  </div>
                  <p className="shrink-0 font-display text-base font-bold text-cream">
                    {formatCurrencyBRL(sale.salePrice)}
                  </p>
                </div>

                <div className="mt-3 space-y-1 text-xs text-muted">
                  <p>
                    Cliente:{" "}
                    <span className="text-cream">{sale.customer.name}</span>
                  </p>
                  <p>{formatPhoneBR(sale.customer.phone)}</p>
                  {sale.notes ? <p className="italic">{sale.notes}</p> : null}
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3">
                  <Badge tone="success">{sale.paymentMethod}</Badge>
                  <a
                    href={`https://wa.me/55${sale.customer.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto p-2 text-muted transition hover:text-cream"
                    aria-label="WhatsApp do cliente"
                  >
                    <IconWhatsApp className="h-4 w-4" />
                  </a>
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
            ))}
          </ul>

          {/* Desktop: tabela. */}
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
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="border-t border-white/10 transition hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-3 text-muted">
                      {formatDate(sale.saleDate)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/veiculos/${sale.vehicle.id}`}
                        className="font-medium text-cream transition hover:text-brand"
                      >
                        {sale.vehicle.brand} {sale.vehicle.model}
                      </Link>
                      <p className="text-xs text-muted">{sale.vehicle.yearModel}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href="/admin/clientes"
                        className="font-medium text-cream transition hover:text-brand"
                      >
                        {sale.customer.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {formatPhoneBR(sale.customer.phone)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="success">{sale.paymentMethod}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrencyBRL(sale.salePrice)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`https://wa.me/55${sale.customer.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-muted transition hover:text-cream"
                          aria-label="WhatsApp do cliente"
                          title="WhatsApp do cliente"
                        >
                          <IconWhatsApp className="h-4 w-4" />
                        </a>
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
                ))}
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
            ? `A venda de ${cancelTarget.vehicle.brand} ${cancelTarget.vehicle.model} será apagada e o veículo volta para o estoque como disponível.`
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
