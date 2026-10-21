"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeSaleFlow } from "@/app/admin/vendas/actions";
import { SearchSelect } from "@/components/admin/SearchSelect";
import { AdminPageHeader, btn, inputClass } from "@/components/admin/ui";
import { formatAdminMoney, moneyInput, parseMoneyBR } from "@/lib/admin-money";
import type { ContractPaymentItem, ContractPaymentMethod } from "@/lib/admin-commercial";

type Vehicle = { id: string; label: string; price: number; status: string; chassis: string | null; renavam: string | null; reservation: { customerId: string; customerName: string; deposit: number } | null };
type Customer = { id: string; label: string; name: string; phone: string; cpf: string; rg: string; address: string };
type VehicleOption = Vehicle & { reservedCustomer?: Customer };
const stages = ["Veículo", "Cliente", "Pagamento", "Vendedor", "Revisar e gerar contrato"];
function Control({ label, value, onChange, onBlur, type = "text", min }: { label: string; value: string | number; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void; type?: string; min?: string }) { return <label className="block text-xs font-medium text-muted">{label}<input type={type} min={min} className={`${inputClass} mt-1.5`} value={value} onChange={onChange} onBlur={onBlur} /></label>; }

async function searchVehicles(q: string, signal?: AbortSignal): Promise<VehicleOption[]> {
  const response = await fetch(`/api/admin/vendas/veiculos?q=${encodeURIComponent(q)}&take=20`, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.vehicles ?? []).map((item: Vehicle & { brand: string; model: string; yearModel: number; reservation: { customerId: string; customer: Omit<Customer, "label">; deposit: number } | null }) => ({ ...item, label: `${item.brand} ${item.model} ${item.yearModel} · ${formatAdminMoney(item.price)}`, reservation: item.reservation ? { customerId: item.reservation.customerId, customerName: item.reservation.customer.name, deposit: item.reservation.deposit } : null, reservedCustomer: item.reservation ? { ...item.reservation.customer, label: `${item.reservation.customer.name} · ${item.reservation.customer.phone}`, cpf: item.reservation.customer.cpf ?? "", rg: item.reservation.customer.rg ?? "", address: item.reservation.customer.address ?? "" } : undefined }));
}
async function searchCustomers(q: string, signal?: AbortSignal): Promise<Customer[]> {
  const response = await fetch(`/api/admin/clientes?q=${encodeURIComponent(q)}&take=20`, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.customers ?? []).map((item: Customer) => ({ ...item, label: `${item.name} · ${item.phone}` }));
}

export function SaleFlow({ initialVehicle, initialCustomer }: { initialVehicle: Vehicle | null; initialCustomer: Customer | null }) {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [vehicle, setVehicle] = useState<Vehicle | null>(initialVehicle);
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);
  const [total, setTotal] = useState(initialVehicle ? moneyInput(initialVehicle.price) : "");
  const [payments, setPayments] = useState<ContractPaymentItem[]>([]);
  const [signal, setSignal] = useState(Boolean(initialVehicle?.reservation && initialVehicle.reservation.deposit > 0));
  const [moneyDrafts, setMoneyDrafts] = useState<Record<string, string>>({});
  const [seller, setSeller] = useState("");
  const [commission, setCommission] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ saleId: string; contractId: string; receiptId?: string; proposalId?: string } | null>(null);
  const [conditions, setConditions] = useState("");
  const [includeProposal, setIncludeProposal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);
  const [ids, setIds] = useState({ chassis: initialVehicle?.chassis ?? "", renavam: initialVehicle?.renavam ?? "", rg: initialCustomer?.rg ?? "" });
  const totalNumber = parseMoneyBR(total) ?? 0;
  const selectedPayments = signal ? [...payments.filter((p) => p.method !== "sinal"), { method: "sinal" as const, amount: vehicle?.reservation?.deposit ?? payments.find((p) => p.method === "sinal")?.amount ?? 0 }] : payments;
  const paymentTotal = selectedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0) + Number(payment.method === "financiamento" ? payment.downPayment || 0 : 0), 0);
  function moneyField(key: string, value: number, update: (amount: number) => void) {
    return { value: moneyDrafts[key] ?? moneyInput(value), onChange: (event: React.ChangeEvent<HTMLInputElement>) => setMoneyDrafts((drafts) => ({ ...drafts, [key]: event.target.value })), onBlur: () => { const parsed = parseMoneyBR(moneyDrafts[key] ?? moneyInput(value)); if (parsed !== null) update(parsed); setMoneyDrafts((drafts) => { const next = { ...drafts }; delete next[key]; return next; }); } };
  }
  function toggle(method: ContractPaymentMethod) {
    if (method === "sinal") { setSignal(!signal); setPayments((rows) => !signal ? [...rows.filter((p) => p.method !== "sinal"), { method, amount: 0 }] : rows.filter((p) => p.method !== "sinal")); return; }
    setPayments((rows) => rows.some((p) => p.method === method) ? rows.filter((p) => p.method !== method) : [...rows, { method, amount: 0 }]);
  }
  function updatePayment(method: ContractPaymentMethod, patch: Partial<ContractPaymentItem>) { setPayments((rows) => rows.map((p) => p.method === method ? { ...p, ...patch } : p)); }
  async function submit() {
    setBusy(true); setError("");
    const result = await finalizeSaleFlow(JSON.stringify({ vehicleId: vehicle?.id, customerId: newCustomer ? "novo" : customer?.id, customerName: customer?.name, customerPhone: customer?.phone, cpf: customer?.cpf, address: customer?.address, total: totalNumber, payments: selectedPayments, signal, seller, commission: commission ? parseMoneyBR(commission) : null, conditions, includeProposal, ...ids }));
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setResult({ saleId: result.saleId!, contractId: result.contractId!, receiptId: result.receiptId, proposalId: result.proposalId });
    router.refresh();
  }
  if (result) return <div className="mx-auto max-w-3xl space-y-5"><AdminPageHeader title="Venda registrada" subtitle={`Venda ${result.saleId}`} /><p>Contrato e venda foram gravados juntos.</p><div className="flex flex-wrap gap-3"><a className={btn.primary} href={`/api/admin/documentos/${result.contractId}`} target="_blank" rel="noreferrer">Abrir contrato (PDF)</a>{result.receiptId && <a className={btn.outline} href={`/api/admin/documentos/${result.receiptId}`} target="_blank" rel="noreferrer">Abrir recibo (PDF)</a>}{result.proposalId && <a className={btn.outline} href={`/api/admin/documentos/${result.proposalId}`} target="_blank" rel="noreferrer">Abrir proposta (PDF)</a>}<a className={btn.outline} href={`/admin/vendas?venda=${result.saleId}`}>Ver venda</a></div></div>;
  return <div className="mx-auto max-w-3xl space-y-6">
    <AdminPageHeader title="Iniciar venda" subtitle="Registre os dados do negócio e gere o contrato." />
    <ol className="grid grid-cols-5 gap-1" aria-label="Etapas">{stages.map((name, i) => <li key={name} className={`min-w-0 break-words border-b-2 py-2 text-[10px] sm:text-xs ${i === stage ? "border-brand font-semibold" : "border-line text-muted"}`}><span className="mr-1">{i + 1}.</span>{name}</li>)}</ol>
    <section className="space-y-4 rounded-xl border border-line p-4 sm:p-6">
      {stage === 0 && <><h2 className="text-lg font-semibold">Veículo</h2><SearchSelect<VehicleOption> name="vehicle" value={vehicle?.id ?? ""} selectedLabel={vehicle?.label ?? ""} onChange={(_, item) => { const v = item ? { id: item.id, label: item.label, price: item.price, status: item.status, reservation: item.reservation, chassis: item.chassis, renavam: item.renavam } : null; setVehicle(v); setTotal(v ? moneyInput(v.price) : ""); setPayments([]); setSignal(Boolean(v?.reservation && v.reservation.deposit > 0)); setMoneyDrafts({}); setCustomer(item?.reservedCustomer ?? null); setNewCustomer(false); setIds({ chassis: v?.chassis ?? "", renavam: v?.renavam ?? "", rg: item?.reservedCustomer?.rg ?? "" }); }} loadOptions={searchVehicles} placeholder="Buscar veículo" /><p className="text-sm text-muted">Preço anunciado: {vehicle ? formatAdminMoney(vehicle.price) : "—"}. O valor negociado pode ser diferente.</p>{vehicle?.reservation && <p role="status">Reserva ativa de {vehicle.reservation.customerName}; sinal de {formatAdminMoney(vehicle.reservation.deposit)}.</p>}<Control label="Chassi" value={ids.chassis} onChange={(e) => setIds({ ...ids, chassis: e.target.value })} /><Control label="RENAVAM" value={ids.renavam} onChange={(e) => setIds({ ...ids, renavam: e.target.value })} /></>}
      {stage === 1 && <><h2 className="text-lg font-semibold">Cliente</h2><label className="flex gap-2"><input type="checkbox" checked={newCustomer} onChange={(e) => { setNewCustomer(e.target.checked); if (e.target.checked) setCustomer({ id: "", label: "Novo cliente", name: "", phone: "", cpf: "", rg: "", address: "" }); else setCustomer(null); }} />Cadastrar cliente nesta venda</label>{!newCustomer && <SearchSelect<Customer> name="customer" value={customer?.id ?? ""} selectedLabel={customer?.label ?? ""} onChange={(_, item) => { setCustomer(item); setIds({ ...ids, rg: item?.rg ?? "" }); }} loadOptions={searchCustomers} placeholder="Buscar cliente" />}{customer && <><Control label="Nome" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /><Control label="Telefone" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /><Control label="CPF" value={customer.cpf} onChange={(e) => setCustomer({ ...customer, cpf: e.target.value })} /><Control label="RG" value={ids.rg} onChange={(e) => setIds({ ...ids, rg: e.target.value })} /><Control label="Endereço" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} /></>}</>}
      {stage === 2 && <><h2 className="text-lg font-semibold">Pagamento</h2><Control label="Valor total negociado" value={total} onChange={(e) => setTotal(e.target.value)} /><div className="flex flex-wrap gap-2">{(["pix", "financiamento", "troca", "cartao"] as ContractPaymentMethod[]).map((m) => <button type="button" key={m} className={btn.outline} onClick={() => toggle(m)}>{payments.some((p) => p.method === m) ? "✓ " : "+ "}{m === "pix" ? "À vista/PIX" : m === "cartao" ? "Cartão" : m[0].toUpperCase() + m.slice(1)}</button>)}<button type="button" className={btn.outline} onClick={() => toggle("sinal")}>{signal ? "✓ Houve sinal" : "Houve sinal"}</button></div>{signal && !vehicle?.reservation && (() => { const field = moneyField("signal", payments.find((p) => p.method === "sinal")?.amount ?? 0, (amount) => updatePayment("sinal", { amount })); return <Control label="Valor do sinal" {...field} />; })()}{payments.filter((p) => p.method !== "sinal").map((p) => <div key={p.method} className="grid gap-3 rounded border p-3 sm:grid-cols-2"><strong>{p.method === "pix" ? "À vista/PIX" : p.method[0].toUpperCase() + p.method.slice(1)}</strong>{p.method !== "financiamento" && (() => { const field = moneyField(p.method, p.amount, (amount) => updatePayment(p.method, { amount })); return <Control label="Valor" {...field} />; })()}{p.method === "financiamento" && <>{(() => { const field = moneyField("entrada", p.downPayment ?? 0, (amount) => updatePayment(p.method, { downPayment: amount })); return <Control label="Entrada adicional" {...field} />; })()}{(() => { const field = moneyField("financiado", p.amount, (amount) => updatePayment(p.method, { amount })); return <Control label="Valor financiado" {...field} />; })()}<Control label="Número de parcelas" type="number" min="1" value={p.installments ?? ""} onChange={(e) => updatePayment(p.method, { installments: Number(e.target.value) })} /></>}{p.method === "troca" && <><Control label="Veículo/descrição" value={p.tradeVehicle ?? ""} onChange={(e) => updatePayment(p.method, { tradeVehicle: e.target.value })} /><Control label="Placa" value={p.tradePlate ?? ""} onChange={(e) => updatePayment(p.method, { tradePlate: e.target.value })} /></>}{p.method === "cartao" && <Control label="Parcelas" type="number" min="1" value={p.installments ?? ""} onChange={(e) => updatePayment(p.method, { installments: Number(e.target.value) })} />}</div>)}<p>Soma informada: {formatAdminMoney(paymentTotal)} · Total: {formatAdminMoney(totalNumber)}</p></>}
      {stage === 3 && <><h2 className="text-lg font-semibold">Vendedor</h2><Control label="Responsável comercial" value={seller} onChange={(e) => setSeller(e.target.value)} /><Control label="Comissão (R$)" value={commission} onChange={(e) => setCommission(e.target.value)} /></>}
      {stage === 4 && <><h2 className="text-lg font-semibold">Revisar e gerar contrato</h2><p>{vehicle?.label} · {customer?.name} · {customer?.phone}{customer?.cpf ? ` · CPF ${customer.cpf}` : ""}</p><p>Total negociado: {formatAdminMoney(totalNumber)}</p><ul className="list-inside list-disc text-sm">{selectedPayments.map((p) => <li key={p.method}>{p.method === "pix" ? `À vista/PIX ${formatAdminMoney(p.amount)}` : p.method === "financiamento" ? `Financiamento: entrada adicional ${formatAdminMoney(p.downPayment ?? 0)}, financiado ${formatAdminMoney(p.amount)}, ${p.installments ?? 0} parcelas` : p.method === "troca" ? `Troca: ${p.tradeVehicle ?? ""} · ${p.tradePlate ?? ""} · ${formatAdminMoney(p.amount)}` : p.method === "cartao" ? `Cartão: ${formatAdminMoney(p.amount)} · ${p.installments ?? 0} parcelas` : `Sinal: ${formatAdminMoney(p.amount)}${vehicle?.reservation ? " (reserva)" : ""}`}</li>)}</ul><p>Data: {new Date().toLocaleDateString("pt-BR")} · Vendedor: {seller || "—"} · Comissão: {formatAdminMoney(parseMoneyBR(commission) ?? 0)}</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeProposal} onChange={(event) => setIncludeProposal(event.target.checked)} />Gerar proposta junto com o contrato</label><label className="block text-xs font-medium text-muted">Condições<textarea className={`${inputClass} mt-1.5`} maxLength={3000} value={conditions} onChange={(e) => setConditions(e.target.value)} /></label></>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-between"><button type="button" className={btn.outline} disabled={stage === 0 || busy} onClick={() => setStage(stage - 1)}>Voltar</button>{stage < 4 && <button type="button" className={btn.primary} onClick={() => setStage(stage + 1)}>Continuar</button>}</div>
    </section>
    {stage === 4 && <button type="button" className={btn.primary} disabled={busy || !vehicle || !customer || !selectedPayments.length || Math.abs(paymentTotal - totalNumber) > 0.01} onClick={submit}>{busy ? "Registrando…" : "Gerar contrato e registrar venda"}</button>}
  </div>;
}
