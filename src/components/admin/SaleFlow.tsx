"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeSaleFlow } from "@/app/admin/vendas/actions";
import { AdminPageHeader, btn } from "@/components/admin/ui";
import { CustomerStage, PaymentStage, ReviewStage, SaleResult, SellerStage, StageProgress, VehicleStage } from "@/components/admin/SaleFlowStages";
import type { Customer, SaleIds, SaleResultData, Vehicle, VehicleOption } from "@/components/admin/SaleFlowStages";
import { adminMutation } from "@/lib/admin-mutation";
import { moneyInput, parseMoneyBR } from "@/lib/admin-money";
import { firstSaleProblem, validateSaleStage } from "@/lib/sale-flow-validation";
import type { SaleDraft } from "@/lib/sale-flow-validation";
import { sumContractPayments, type ContractPaymentItem, type ContractPaymentMethod } from "@/lib/admin-commercial";

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
  const [issuingNotes, setIssuingNotes] = useState(false);
  const [newCustomer, setNewCustomer] = useState(false);
  const [ids, setIds] = useState<SaleIds>({ chassis: initialVehicle?.chassis ?? "", renavam: initialVehicle?.renavam ?? "", rg: initialCustomer?.rg ?? "" });
  const totalNumber = parseMoneyBR(total) ?? 0;
  const heldDeposit = vehicle?.reservation && vehicle.reservation.deposit > 0 ? vehicle.reservation.deposit : null;
  const selectedPayments = signal
    ? [...payments.filter((p) => p.method !== "sinal"), { method: "sinal" as const, amount: heldDeposit ?? payments.find((p) => p.method === "sinal")?.amount ?? 0 }]
    : payments;
  const paymentTotal = sumContractPayments(selectedPayments);

  const draft: SaleDraft = { vehicleId: vehicle?.id ?? "", customer, total: totalNumber, payments: selectedPayments, commission };

  function goTo(next: number) {
    setError("");
    setStage(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function notesProblem(forStage: number) {
    if (forStage !== 2 || !payments.some((p) => p.method === "promissoria" && !p.noteIds?.length)) return null;
    return "Promissória: emita as notas antes de continuar.";
  }

  function advance() {
    const message = validateSaleStage(stage, draft) ?? notesProblem(stage);
    if (message) { setError(message); return; }
    goTo(stage + 1);
  }

  function moneyField(key: string, value: number, update: (amount: number) => void) {
    const dropDraft = () => setMoneyDrafts((drafts) => { const next = { ...drafts }; delete next[key]; return next; });
    return {
      value: moneyDrafts[key] ?? moneyInput(value),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setMoneyDrafts((drafts) => ({ ...drafts, [key]: value }));
        update(parseMoneyBR(value) ?? 0);
      },
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
    setPayments((rows) => rows.filter((payment) => payment.method !== "promissoria"));
    setNewCustomer(checked);
    if (checked) {
      setCustomer({ id: "", label: "Novo cliente", name: "", phone: "", cpf: "", rg: "", address: "" });
      setIds({ ...ids, rg: "" });
    } else setCustomer(null);
  }

  function pickCustomer(item: Customer | null) {
    setPayments((rows) => rows.filter((payment) => payment.method !== "promissoria"));
    setCustomer(item);
    setIds({ ...ids, rg: item?.rg ?? "" });
  }

  async function submit() {
    const problem = firstSaleProblem(draft);
    const notes = notesProblem(2);
    if (!problem && notes) { setStage(2); setError(notes); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (problem) { setStage(problem.stage); setError(problem.message); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setBusy(true); setError("");
    const response = await adminMutation(() => finalizeSaleFlow(JSON.stringify({
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
    })));
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
        {stage === 1 && <CustomerStage customer={customer} newCustomer={newCustomer} ids={ids} onNewCustomerToggle={toggleNewCustomer} onCustomerPick={pickCustomer} onCustomerEdit={(item) => { if (item.cpf !== customer?.cpf) setPayments((rows) => rows.filter((payment) => payment.method !== "promissoria")); setCustomer(item); }} onIdsChange={setIds} />}
        {stage === 2 && <PaymentStage customer={customer ? { ...customer, rg: ids.rg } : null} notesBusy={issuingNotes} onBusyChange={setIssuingNotes} vehicle={vehicle} total={total} payments={payments} signal={signal} paymentTotal={paymentTotal} totalNumber={totalNumber} moneyField={moneyField} onTotalChange={setTotal} onToggle={toggle} updatePayment={updatePayment} />}
        {stage === 3 && <SellerStage seller={seller} commission={commission} onSellerChange={setSeller} onCommissionChange={setCommission} />}
        {stage === 4 && <ReviewStage vehicle={vehicle} customer={customer} totalNumber={totalNumber} selectedPayments={selectedPayments} seller={seller} commission={commission} includeProposal={includeProposal} conditions={conditions} onIncludeProposalChange={setIncludeProposal} onConditionsChange={setConditions} />}
        {error && <p role="alert" className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" className={`${btn.outline} w-full sm:w-auto`} disabled={stage === 0 || busy || issuingNotes} onClick={() => goTo(stage - 1)}>Voltar</button>
          {stage < 4 && <button type="button" className={`${btn.primary} w-full sm:w-auto`} disabled={issuingNotes} onClick={advance}>Continuar</button>}
        </div>
      </section>
      {stage === 4 && <button type="button" className={`${btn.primary} w-full sm:w-auto`} disabled={busy || issuingNotes} onClick={submit}>{busy ? "Registrando…" : "Gerar contrato e registrar venda"}</button>}
    </div>
  );
}
