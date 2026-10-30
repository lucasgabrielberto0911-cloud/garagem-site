"use client";

import { SalePromissoryPayment } from "./SalePromissoryPayment";
import { SearchSelect } from "@/components/admin/SearchSelect";
import { AdminPageHeader, btn, inputClass } from "@/components/admin/ui";
import { formatAdminMoney, parseMoneyBR } from "@/lib/admin-money";
import type { ContractPaymentItem, ContractPaymentMethod } from "@/lib/admin-commercial";
import { formatCpfBR, formatPhoneBR } from "@/lib/format";

export type Vehicle = { id: string; label: string; price: number; status: string; chassis: string | null; renavam: string | null; reservation: { customerId: string; customerName: string; deposit: number } | null };
export type Customer = { id: string; label: string; name: string; phone: string; cpf: string; rg: string; address: string };
export type VehicleOption = Vehicle & { reservedCustomer?: Customer };
export type SaleIds = { chassis: string; renavam: string; rg: string };
export type SaleResultData = { saleId: string; contractId: string; receiptId?: string; proposalId?: string };
type MoneyField = { value: string; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; onBlur: () => void };
type MoneyFieldFactory = (key: string, value: number, update: (amount: number) => void) => MoneyField;

export const stages = ["Veículo", "Cliente", "Pagamento", "Vendedor", "Revisar e gerar contrato"];

type ControlProps = {
  label: string;
  value: string | number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  type?: string;
  min?: string;
  inputMode?: "numeric" | "decimal" | "tel";
  hint?: string;
};

function Control({ label, value, onChange, onBlur, type = "text", min, inputMode, hint }: ControlProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted">
        {label}
        <input type={type} min={min} inputMode={inputMode} autoComplete="off" className={`${inputClass} mt-1.5`} value={value} onChange={onChange} onBlur={onBlur} />
      </label>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export async function searchVehicles(q: string, signal?: AbortSignal): Promise<VehicleOption[]> {
  const response = await fetch(`/api/admin/vendas/veiculos?q=${encodeURIComponent(q)}&take=20`, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  type ApiVehicle = Vehicle & {
    brand: string;
    model: string;
    yearModel: number;
    reservation: { customerId: string; customer: Omit<Customer, "label">; deposit: number } | null;
  };
  return (data.vehicles ?? []).map((item: ApiVehicle) => {
    const held = item.reservation;
    return {
      ...item,
      label: `${item.brand} ${item.model} ${item.yearModel} · ${formatAdminMoney(item.price)}`,
      reservation: held ? { customerId: held.customerId, customerName: held.customer.name, deposit: held.deposit } : null,
      reservedCustomer: held
        ? { ...held.customer, label: `${held.customer.name} · ${held.customer.phone}`, cpf: held.customer.cpf ?? "", rg: held.customer.rg ?? "", address: held.customer.address ?? "" }
        : undefined,
    };
  });
}

export async function searchCustomers(q: string, signal?: AbortSignal): Promise<Customer[]> {
  const response = await fetch(`/api/admin/clientes?q=${encodeURIComponent(q)}&take=20`, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.customers ?? []).map((item: Customer) => ({ ...item, phone: item.phone ?? "", cpf: item.cpf ?? "", rg: item.rg ?? "", address: item.address ?? "", label: `${item.name} · ${item.phone ?? ""}` }));
}

function methodLabel(method: ContractPaymentMethod) {
  return method === "pix" ? "À vista/PIX" : method === "cartao" ? "Cartão" : method === "promissoria" ? "Promissória" : method[0].toUpperCase() + method.slice(1);
}

function describePayment(p: ContractPaymentItem, hasReservedSignal: boolean) {
  if (p.method === "promissoria") return `Promissórias: ${formatAdminMoney(p.amount)} · ${(p.notes ?? []).map((note) => `nº ${note.number}, vence ${note.dueDate.split("-").reverse().join("/")}`).join("; ")}`;
  if (p.method === "pix") return `À vista/PIX ${formatAdminMoney(p.amount)}`;
  if (p.method === "financiamento") return `Financiamento: entrada adicional ${formatAdminMoney(p.downPayment ?? 0)}, financiado ${formatAdminMoney(p.amount)}, ${p.installments ?? 0} parcelas`;
  if (p.method === "troca") return `Troca: ${p.tradeVehicle ?? ""} · ${p.tradePlate ?? ""} · ${formatAdminMoney(p.amount)}`;
  if (p.method === "cartao") return `Cartão: ${formatAdminMoney(p.amount)} · ${p.installments ?? 0} parcelas`;
  return `Sinal: ${formatAdminMoney(p.amount)}${hasReservedSignal ? " (reserva)" : ""}`;
}

export function StageProgress({ stage }: { stage: number }) {
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Etapas">
      {stages.map((name, i) => (
        <li key={name} className={`min-w-0 break-words border-b-2 py-2 text-[10px] sm:text-xs ${i === stage ? "border-brand font-semibold" : "border-line text-muted"}`}>
          <span className="block">{i + 1}.</span>{i === 4 ? "Revisão" : name}
        </li>
      ))}
    </ol>
  );
}

export function VehicleStage({ vehicle, ids, onVehicleChange, onIdsChange }: { vehicle: Vehicle | null; ids: SaleIds; onVehicleChange: (item: VehicleOption | null) => void; onIdsChange: (ids: SaleIds) => void }) {
  return (
    <>
      <h2 className="text-lg font-semibold">Veículo</h2>
      <SearchSelect<VehicleOption> name="vehicle" value={vehicle?.id ?? ""} selectedLabel={vehicle?.label ?? ""} onChange={(_, item) => onVehicleChange(item)} loadOptions={searchVehicles} placeholder="Buscar veículo" />
      <p className="text-sm text-muted">Preço anunciado: {vehicle ? formatAdminMoney(vehicle.price) : "—"}. O valor negociado pode ser diferente.</p>
      {vehicle?.reservation && <p role="status">Reserva ativa de {vehicle.reservation.customerName}; sinal de {formatAdminMoney(vehicle.reservation.deposit)}.</p>}
      <Control label="Chassi" value={ids.chassis} onChange={(e) => onIdsChange({ ...ids, chassis: e.target.value })} />
      <Control label="RENAVAM" value={ids.renavam} onChange={(e) => onIdsChange({ ...ids, renavam: e.target.value })} />
    </>
  );
}

export function CustomerStage({ customer, newCustomer, ids, onNewCustomerToggle, onCustomerPick, onCustomerEdit, onIdsChange }: { customer: Customer | null; newCustomer: boolean; ids: SaleIds; onNewCustomerToggle: (checked: boolean) => void; onCustomerPick: (customer: Customer | null) => void; onCustomerEdit: (customer: Customer) => void; onIdsChange: (ids: SaleIds) => void }) {
  return (
    <>
      <h2 className="text-lg font-semibold">Cliente</h2>
      <label className="flex gap-2">
        <input type="checkbox" checked={newCustomer} onChange={(e) => onNewCustomerToggle(e.target.checked)} />
        Cadastrar cliente nesta venda
      </label>
      {!newCustomer && <SearchSelect<Customer> name="customer" value={customer?.id ?? ""} selectedLabel={customer?.label ?? ""} onChange={(_, item) => onCustomerPick(item)} loadOptions={searchCustomers} placeholder="Buscar cliente" />}
      {customer && (
        <>
          <Control label="Nome" hint="Obrigatório." value={customer.name} onChange={(e) => onCustomerEdit({ ...customer, name: e.target.value })} />
          <Control label="Telefone" inputMode="tel" hint="Obrigatório, com DDD." value={formatPhoneBR(customer.phone)} onChange={(e) => onCustomerEdit({ ...customer, phone: formatPhoneBR(e.target.value) })} />
          <Control label="CPF" inputMode="numeric" hint="Opcional, mas entra no contrato." value={formatCpfBR(customer.cpf)} onChange={(e) => onCustomerEdit({ ...customer, cpf: formatCpfBR(e.target.value) })} />
          <Control label="RG" value={ids.rg} onChange={(e) => onIdsChange({ ...ids, rg: e.target.value })} />
          <Control label="Endereço" value={customer.address} onChange={(e) => onCustomerEdit({ ...customer, address: e.target.value })} />
        </>
      )}
    </>
  );
}

function PaymentCard({ p, moneyField, updatePayment }: { p: ContractPaymentItem; moneyField: MoneyFieldFactory; updatePayment: (method: ContractPaymentMethod, patch: Partial<ContractPaymentItem>) => void }) {
  const installments = (label: string) => (
    <Control label={label} type="number" inputMode="numeric" min="1" value={p.installments ?? ""} onChange={(e) => updatePayment(p.method, { installments: Number(e.target.value) })} />
  );
  return (
    <div className="grid gap-3 rounded border p-3 sm:grid-cols-2">
      <strong>{methodLabel(p.method)}</strong>
      {p.method !== "financiamento" && <Control label="Valor" inputMode="decimal" {...moneyField(p.method, p.amount, (amount) => updatePayment(p.method, { amount }))} />}
      {p.method === "financiamento" && (
        <>
          <Control label="Entrada adicional" inputMode="decimal" {...moneyField("entrada", p.downPayment ?? 0, (amount) => updatePayment(p.method, { downPayment: amount }))} />
          <Control label="Valor financiado" inputMode="decimal" {...moneyField("financiado", p.amount, (amount) => updatePayment(p.method, { amount }))} />
          {installments("Número de parcelas")}
        </>
      )}
      {p.method === "troca" && (
        <>
          <Control label="Veículo/descrição" value={p.tradeVehicle ?? ""} onChange={(e) => updatePayment(p.method, { tradeVehicle: e.target.value })} />
          <Control label="Placa" value={p.tradePlate ?? ""} onChange={(e) => updatePayment(p.method, { tradePlate: e.target.value })} />
        </>
      )}
      {p.method === "cartao" && installments("Parcelas")}
    </div>
  );
}

export function PaymentStage({ customer, notesBusy, onBusyChange, vehicle, total, payments, signal, paymentTotal, totalNumber, moneyField, onTotalChange, onToggle, updatePayment }: {
  customer: Customer | null;
  notesBusy: boolean;
  onBusyChange: (busy: boolean) => void;
  vehicle: Vehicle | null;
  total: string;
  payments: ContractPaymentItem[];
  signal: boolean;
  paymentTotal: number;
  totalNumber: number;
  moneyField: MoneyFieldFactory;
  onTotalChange: (value: string) => void;
  onToggle: (method: ContractPaymentMethod) => void;
  updatePayment: (method: ContractPaymentMethod, patch: Partial<ContractPaymentItem>) => void;
}) {
  const hasReservedSignal = Boolean(vehicle?.reservation && vehicle.reservation.deposit > 0);
  return (
    <>
      <h2 className="text-lg font-semibold">Pagamento</h2>
      <Control label="Valor total negociado" inputMode="decimal" value={total} onChange={(e) => onTotalChange(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {(["pix", "financiamento", "troca", "cartao", "promissoria"] as ContractPaymentMethod[]).map((m) => (
          <button type="button" key={m} className={btn.outline} disabled={notesBusy} aria-pressed={payments.some((p) => p.method === m)} onClick={() => onToggle(m)}>
            {payments.some((p) => p.method === m) ? "✓ " : "+ "}{methodLabel(m)}
          </button>
        ))}
        <button type="button" className={btn.outline} disabled={notesBusy} onClick={() => onToggle("sinal")}>{signal ? "✓ Houve sinal" : "Houve sinal"}</button>
      </div>
      {signal && !hasReservedSignal && <Control label="Valor do sinal" inputMode="decimal" {...moneyField("signal", payments.find((p) => p.method === "sinal")?.amount ?? 0, (amount) => updatePayment("sinal", { amount }))} />}
      {payments.filter((p) => p.method !== "sinal" && p.method !== "promissoria").map((p) => <PaymentCard key={p.method} p={p} moneyField={moneyField} updatePayment={updatePayment} />)}
      {payments.filter((p) => p.method === "promissoria").map((p) => <SalePromissoryPayment key={customer?.id + (customer?.cpf ?? "")} payment={p} customer={customer} remaining={Math.round((totalNumber - paymentTotal) * 100) / 100} onChange={(patch) => updatePayment("promissoria", patch)} onBusyChange={onBusyChange} />)}
      <p role="status" className={Math.abs(totalNumber - paymentTotal) <= 0.01 && totalNumber > 0 ? "text-sm text-emerald-700" : "text-sm"}>
        Soma informada: {formatAdminMoney(paymentTotal)} · Total: {formatAdminMoney(totalNumber)}
        {totalNumber > 0 && Math.abs(totalNumber - paymentTotal) > 0.01 ? ` · ${totalNumber > paymentTotal ? "faltam" : "sobram"} ${formatAdminMoney(Math.abs(totalNumber - paymentTotal))}` : totalNumber > 0 ? " · fechou" : ""}
      </p>
    </>
  );
}

export function SellerStage({ seller, commission, onSellerChange, onCommissionChange }: { seller: string; commission: string; onSellerChange: (value: string) => void; onCommissionChange: (value: string) => void }) {
  return (
    <>
      <h2 className="text-lg font-semibold">Vendedor</h2>
      <Control label="Responsável comercial" value={seller} onChange={(e) => onSellerChange(e.target.value)} />
      <Control label="Comissão (R$)" inputMode="decimal" value={commission} onChange={(e) => onCommissionChange(e.target.value)} />
    </>
  );
}

export function ReviewStage({ vehicle, customer, totalNumber, selectedPayments, seller, commission, includeProposal, conditions, onIncludeProposalChange, onConditionsChange }: {
  vehicle: Vehicle | null;
  customer: Customer | null;
  totalNumber: number;
  selectedPayments: ContractPaymentItem[];
  seller: string;
  commission: string;
  includeProposal: boolean;
  conditions: string;
  onIncludeProposalChange: (value: boolean) => void;
  onConditionsChange: (value: string) => void;
}) {
  const hasReservedSignal = Boolean(vehicle?.reservation && vehicle.reservation.deposit > 0);
  return (
    <>
      <h2 className="text-lg font-semibold">Revisar e gerar contrato</h2>
      <p>{vehicle?.label} · {customer?.name} · {customer?.phone}{customer?.cpf ? ` · CPF ${customer.cpf}` : ""}</p>
      <p>Total negociado: {formatAdminMoney(totalNumber)}</p>
      <ul className="list-inside list-disc text-sm">{selectedPayments.map((p) => <li key={p.method}>{describePayment(p, hasReservedSignal)}</li>)}</ul>
      <p>Data: {new Date().toLocaleDateString("pt-BR")} · Vendedor: {seller || "—"} · Comissão: {formatAdminMoney(parseMoneyBR(commission) ?? 0)}</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={includeProposal} onChange={(event) => onIncludeProposalChange(event.target.checked)} />
        Gerar proposta junto com o contrato
      </label>
      <label className="block text-xs font-medium text-muted">
        Condições
        <textarea className={`${inputClass} mt-1.5`} maxLength={3000} value={conditions} onChange={(e) => onConditionsChange(e.target.value)} />
      </label>
    </>
  );
}

export function SaleResult({ result }: { result: SaleResultData }) {
  const pdf = (id: string) => `/api/admin/documentos/${id}`;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <AdminPageHeader title="Venda registrada" subtitle={`Venda ${result.saleId}`} />
      <p>Contrato e venda foram gravados juntos.</p>
      <div className="flex flex-wrap gap-3">
        <a className={btn.primary} href={pdf(result.contractId)} target="_blank" rel="noreferrer">Abrir contrato (PDF)</a>
        {result.receiptId && <a className={btn.outline} href={pdf(result.receiptId)} target="_blank" rel="noreferrer">Abrir recibo (PDF)</a>}
        {result.proposalId && <a className={btn.outline} href={pdf(result.proposalId)} target="_blank" rel="noreferrer">Abrir proposta (PDF)</a>}
        <a className={btn.outline} href={`/admin/vendas?venda=${result.saleId}`}>Ver venda</a>
      </div>
    </div>
  );
}
