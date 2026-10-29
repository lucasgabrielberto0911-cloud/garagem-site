"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeSaleFlow } from "@/app/admin/vendas/actions";
import { AdminPageHeader, btn } from "@/components/admin/ui";
import { CustomerStage, PaymentStage, ReviewStage, SaleResult, SellerStage, StageProgress, VehicleStage } from "@/components/admin/SaleFlowStages";
import type { Customer, SaleIds, SaleResultData, Vehicle, VehicleOption } from "@/components/admin/SaleFlowStages";
import { moneyInput, parseMoneyBR } from "@/lib/admin-money";
import type { ContractPaymentItem, ContractPaymentMethod } from "@/lib/admin-commercial";

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
  const [result, setResult] = useState<SaleResultData | null>(null);
  const [conditions, setConditions] = useState("");
  const [includeProposal, setIncludeProposal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);
  const [ids, setIds] = useState<SaleIds>({ chassis: initialVehicle?.chassis ?? "", renavam: initialVehicle?.renavam ?? "", rg: initialCustomer?.rg ?? "" });
  const totalNumber = parseMoneyBR(total) ?? 0;
  const heldDeposit = vehicle?.reservation && vehicle.reservation.deposit > 0 ? vehicle.reservation.deposit : null;
  const selectedPayments = signal
    ? [...payments.filter((p) => p.method !== "sinal"), { method: "sinal" as const, amount: heldDeposit ?? payments.find((p) => p.method === "sinal")?.amount ?? 0 }]
    : payments;
  const paymentTotal = selectedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0) + Number(payment.method === "financiamento" ? payment.downPayment || 0 : 0), 0);

  function moneyField(key: string, value: number, update: (amount: number) => void) {
    const dropDraft = () => setMoneyDrafts((drafts) => { const next = { ...drafts }; delete next[key]; return next; });
    return {
      value: moneyDrafts[key] ?? moneyInput(value),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setMoneyDrafts((drafts) => ({ ...drafts, [key]: event.target.value })),
      onBlur: () => {
        const parsed = parseMoneyBR(moneyDrafts[key] ?? moneyInput(value));
        if (parsed !== null) update(parsed);
        dropDraft();
      },
    };
  }

  function toggle(method: ContractPaymentMethod) {
    if (method === "sinal") {
      setSignal(!signal);
      setPayments((rows) => !signal ? [...rows.filter((p) => p.method !== "sinal"), { method, amount: 0 }] : rows.filter((p) => p.method !== "sinal"));
      return;
    }
    setPayments((rows) => rows.some((p) => p.method === method) ? rows.filter((p) => p.method !== method) : [...rows, { method, amount: 0 }]);
  }

  function updatePayment(method: ContractPaymentMethod, patch: Partial<ContractPaymentItem>) {
    setPayments((rows) => rows.map((p) => p.method === method ? { ...p, ...patch } : p));
  }

  function changeVehicle(item: VehicleOption | null) {
    const v = item ? { id: item.id, label: item.label, price: item.price, status: item.status, reservation: item.reservation, chassis: item.chassis, renavam: item.renavam } : null;
    setVehicle(v);
    setTotal(v ? moneyInput(v.price) : "");
    setPayments([]);
    setSignal(Boolean(v?.reservation && v.reservation.deposit > 0));
    setMoneyDrafts({});
    setCustomer(item?.reservedCustomer ?? (item?.reservation ? null : customer));
    setNewCustomer(false);
    setIds({ chassis: v?.chassis ?? "", renavam: v?.renavam ?? "", rg: item?.reservedCustomer?.rg ?? customer?.rg ?? "" });
  }

  function toggleNewCustomer(checked: boolean) {
    setNewCustomer(checked);
    if (checked) {
      setCustomer({ id: "", label: "Novo cliente", name: "", phone: "", cpf: "", rg: "", address: "" });
      setIds({ ...ids, rg: "" });
    } else setCustomer(null);
  }

  function pickCustomer(item: Customer | null) {
    setCustomer(item);
    setIds({ ...ids, rg: item?.rg ?? "" });
  }

  async function submit() {
    setBusy(true); setError("");
    const response = await finalizeSaleFlow(JSON.stringify({
      vehicleId: vehicle?.id,
      customerId: newCustomer ? "novo" : customer?.id,
      customerName: customer?.name,
      customerPhone: customer?.phone,
      cpf: customer?.cpf,
      address: customer?.address,
      total: totalNumber,
      payments: selectedPayments,
      signal,
      seller,
      commission: commission ? parseMoneyBR(commission) : null,
      conditions,
      includeProposal,
      ...ids,
    }));
    setBusy(false);
    if (!response.ok) { setError(response.message); return; }
    setResult({ saleId: response.saleId!, contractId: response.contractId!, receiptId: response.receiptId, proposalId: response.proposalId });
    router.refresh();
  }

  if (result) return <SaleResult result={result} />;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AdminPageHeader title="Iniciar venda" subtitle="Registre os dados do negócio e gere o contrato." />
      <StageProgress stage={stage} />
      <section className="space-y-4 rounded-xl border border-line p-4 sm:p-6">
        {stage === 0 && <VehicleStage vehicle={vehicle} ids={ids} onVehicleChange={changeVehicle} onIdsChange={setIds} />}
        {stage === 1 && <CustomerStage customer={customer} newCustomer={newCustomer} ids={ids} onNewCustomerToggle={toggleNewCustomer} onCustomerPick={pickCustomer} onCustomerEdit={setCustomer} onIdsChange={setIds} />}
        {stage === 2 && <PaymentStage vehicle={vehicle} total={total} payments={payments} signal={signal} paymentTotal={paymentTotal} totalNumber={totalNumber} moneyField={moneyField} onTotalChange={setTotal} onToggle={toggle} updatePayment={updatePayment} />}
        {stage === 3 && <SellerStage seller={seller} commission={commission} onSellerChange={setSeller} onCommissionChange={setCommission} />}
        {stage === 4 && <ReviewStage vehicle={vehicle} customer={customer} totalNumber={totalNumber} selectedPayments={selectedPayments} seller={seller} commission={commission} includeProposal={includeProposal} conditions={conditions} onIncludeProposalChange={setIncludeProposal} onConditionsChange={setConditions} />}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-between">
          <button type="button" className={btn.outline} disabled={stage === 0 || busy} onClick={() => setStage((current) => current - 1)}>Voltar</button>
          {stage < 4 && <button type="button" className={btn.primary} onClick={() => setStage((current) => current + 1)}>Continuar</button>}
        </div>
      </section>
      {stage === 4 && <button type="button" className={btn.primary} disabled={busy || !vehicle || !customer || !selectedPayments.length || Math.abs(paymentTotal - totalNumber) > 0.01} onClick={submit}>{busy ? "Registrando…" : "Gerar contrato e registrar venda"}</button>}
    </div>
  );
}
