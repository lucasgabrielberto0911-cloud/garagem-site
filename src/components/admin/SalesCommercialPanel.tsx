"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCommercial } from "@/app/admin/veiculos/commercial-actions";
import {
  CONTRACT_PAYMENT_METHODS,
  type ContractPaymentItem,
  type ContractPaymentMethod,
  simulateFinancing,
  sumContractPayments,
  summarizeContractPayments,
} from "@/lib/admin-commercial";
import { fetchDocFile, shareDocFile } from "@/lib/commercial-client";
import {
  formatAdminMoney as formatCurrencyBRL,
  moneyDifference,
  moneyInput,
  moneyTyping,
  parseMoneyBR,
} from "@/lib/admin-money";
import { formatPhoneBR, formatPlateDisplay, formatPlateInput } from "@/lib/format";
import { SearchSelect } from "./SearchSelect";
import { btn, Card, Field, inputClass } from "./ui";
import type { SellableVehicle, CustomerOption } from "./SalesManager";

type GeneratedDoc = {
  id: string;
  kind: string;
  number?: number;
  file?: File | null;
};

type Props = {
  initialVehicle?: SellableVehicle | null;
  initialCustomer?: CustomerOption | null;
  onClose?: () => void;
};

export function SalesCommercialPanel({ initialVehicle, initialCustomer, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [vehicleId, setVehicleId] = useState(initialVehicle?.id ?? "");
  const [pickedVehicle, setPickedVehicle] = useState<SellableVehicle | null>(initialVehicle ?? null);

  const [customerId, setCustomerId] = useState(initialCustomer?.id ?? "");
  const [pickedCustomer, setPickedCustomer] = useState<CustomerOption | null>(initialCustomer ?? null);

  const initialPriceStr = initialVehicle?.price ? moneyInput(initialVehicle.price) : "";
  const [price, setPrice] = useState(initialPriceStr);

  // Seleção múltipla de formas de pagamento do contrato
  const [selectedMethods, setSelectedMethods] = useState<ContractPaymentMethod[]>(["pix"]);

  // À vista / PIX
  const [pixAmount, setPixAmount] = useState(initialPriceStr);

  // Financiamento
  const [bank, setBank] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [months, setMonths] = useState("48");
  const [financedAmount, setFinancedAmount] = useState("");
  const [rate, setRate] = useState("1,50");

  // Troca (carro na troca)
  const [tradeVehicle, setTradeVehicle] = useState("");
  const [tradePlate, setTradePlate] = useState("");
  const [tradeAmount, setTradeAmount] = useState("");

  // Cartão
  const [cardAmount, setCardAmount] = useState("");
  const [cardInstallments, setCardInstallments] = useState("1");

  // Sinal (no contrato e no recibo de sinal separado)
  const [deposit, setDeposit] = useState("");
  const [signalDate, setSignalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState("");
  const [receiptPayment, setReceiptPayment] = useState("À vista via Pix");

  const [conditions, setConditions] = useState("");
  const [simulation, setSimulation] = useState<ReturnType<typeof simulateFinancing> | null>(null);
  const [message, setMessage] = useState("");
  const [lastDoc, setLastDoc] = useState<GeneratedDoc | null>(null);
  const [sessionDocs, setSessionDocs] = useState<GeneratedDoc[]>([]);

  function toggleMethod(method: ContractPaymentMethod) {
    setSelectedMethods((prev) => {
      const exists = prev.includes(method);
      const next = exists ? prev.filter((m) => m !== method) : [...prev, method];
      const total = parseMoneyBR(price) ?? 0;
      if (!exists && total > 0) {
        if (method === "pix" && !pixAmount) {
          setPixAmount(moneyInput(total));
        } else if (method === "financiamento" && !financedAmount) {
          const sinalVal = next.includes("sinal") ? (parseMoneyBR(deposit) ?? 0) : 0;
          const downVal = parseMoneyBR(downPayment) ?? 0;
          const rem = Math.max(0, moneyDifference(total, sinalVal + downVal));
          if (rem > 0) setFinancedAmount(moneyInput(rem));
        }
      }
      return next;
    });
    setSimulation(null);
  }

  function buildPaymentItems(): ContractPaymentItem[] {
    const items: ContractPaymentItem[] = [];
    for (const method of CONTRACT_PAYMENT_METHODS.map((m) => m.id)) {
      if (!selectedMethods.includes(method)) continue;
      if (method === "sinal") {
        items.push({
          method: "sinal",
          amount: parseMoneyBR(deposit) ?? 0,
          signalDate: signalDate || undefined,
        });
      } else if (method === "pix") {
        items.push({
          method: "pix",
          amount: parseMoneyBR(pixAmount) ?? 0,
        });
      } else if (method === "financiamento") {
        const down = parseMoneyBR(downPayment) ?? 0;
        const fin = parseMoneyBR(financedAmount) ?? 0;
        const inst = Number(months);
        items.push({
          method: "financiamento",
          amount: fin,
          bank: bank.trim() || undefined,
          downPayment: down > 0 ? down : undefined,
          installments: Number.isInteger(inst) && inst > 0 ? inst : undefined,
        });
      } else if (method === "troca") {
        items.push({
          method: "troca",
          amount: parseMoneyBR(tradeAmount) ?? 0,
          tradeVehicle: tradeVehicle.trim() || undefined,
          tradePlate: tradePlate.trim() || undefined,
        });
      } else if (method === "cartao") {
        const inst = Number(cardInstallments);
        items.push({
          method: "cartao",
          amount: parseMoneyBR(cardAmount) ?? 0,
          installments: Number.isInteger(inst) && inst > 0 ? inst : undefined,
        });
      }
    }
    return items;
  }

  const totalPrice = parseMoneyBR(price) ?? 0;
  const activeItems = buildPaymentItems();
  const paymentsSum = sumContractPayments(activeItems);
  const diff = moneyDifference(totalPrice, paymentsSum);
  const sumMatches = totalPrice > 0 && Math.abs(diff) <= 0.01 && activeItems.length > 0;

  async function loadVehicleOptions(query: string, signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("take", "20");
    const response = await fetch(`/api/admin/vendas/veiculos?${params}`, { signal });
    if (!response.ok) throw new Error("fetch");
    const data = (await response.json()) as { vehicles?: (SellableVehicle & { plate?: string | null })[] };
    return (data.vehicles ?? []).map((v) => ({
      ...v,
      label: `${v.brand} ${v.model}${v.version ? ` ${v.version}` : ""}${v.plate ? ` (${formatPlateDisplay(v.plate)})` : ""} · ${v.yearModel} · ${formatCurrencyBRL(v.price)}`,
    }));
  }

  async function loadCustomerOptions(query: string, signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("take", "20");
    const response = await fetch(`/api/admin/clientes?${params}`, { signal });
    if (!response.ok) throw new Error("fetch");
    const data = (await response.json()) as { customers?: CustomerOption[] };
    return (data.customers ?? []).map((c) => ({
      ...c,
      label: `${c.name}${c.phone ? ` · ${formatPhoneBR(c.phone)}` : ""}${c.cpf ? ` · CPF ${c.cpf}` : ""}`,
    }));
  }

  function handleCalculateSimulation() {
    const p = parseMoneyBR(price) ?? 0;
    const fin = parseMoneyBR(financedAmount) ?? 0;
    const d = fin > 0 && fin < p ? moneyDifference(p, fin) : (parseMoneyBR(downPayment) ?? parseMoneyBR(deposit) ?? 0);
    const r = Number(rate.replace(",", "."));
    const m = Number(months);
    if (!p || p <= 0 || !m || m <= 0) {
      setMessage("Informe o valor do veículo e o prazo em meses para simular.");
      return;
    }
    try {
      const sim = simulateFinancing(p, d, r, m);
      setSimulation(sim);
      setMessage("");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  function handleGenerateDoc(kind: "contrato" | "recibo") {
    if (!vehicleId) {
      setMessage("Escolha um veículo do estoque.");
      return;
    }
    if (!customerId || customerId === "novo") {
      setMessage("Escolha um cliente cadastrado.");
      return;
    }

    const form = new FormData();
    form.set("operation", "document");
    form.set("kind", kind);
    form.set("customerId", customerId);
    if (conditions.trim()) form.set("conditions", conditions.trim());

    if (kind === "contrato") {
      const amountVal = parseMoneyBR(price);
      if (!amountVal || amountVal <= 0) {
        setMessage("Informe o valor do veículo.");
        return;
      }
      if (selectedMethods.length === 0) {
        setMessage("Selecione pelo menos uma forma de pagamento.");
        return;
      }
      if (Math.abs(moneyDifference(amountVal, paymentsSum)) > 0.01) {
        setMessage("A soma das formas de pagamento deve bater com o valor total do veículo.");
        return;
      }
      const summary = summarizeContractPayments(activeItems);
      form.set("amount", price);
      form.set("payment", summary);
      form.set("payments", JSON.stringify(activeItems));

      if (selectedMethods.includes("sinal") && deposit) {
        form.set("deposit", deposit);
      }
      if (selectedMethods.includes("financiamento")) {
        const sinalVal = selectedMethods.includes("sinal") ? (parseMoneyBR(deposit) ?? 0) : 0;
        const downVal = parseMoneyBR(downPayment) ?? 0;
        if (sinalVal + downVal > 0) {
          form.set("downPayment", moneyInput(sinalVal + downVal));
        }
        if (financedAmount) form.set("financed", financedAmount);
        if (bank.trim()) form.set("bank", bank.trim());
        if (rate) form.set("rate", rate);
        if (months) form.set("months", months);
      }
    } else {
      const depositVal = parseMoneyBR(deposit);
      if (!depositVal || depositVal <= 0) {
        setMessage("Informe o valor do sinal recebido.");
        return;
      }
      if (!receiptPayment.trim()) {
        setMessage("Informe a forma de pagamento do sinal.");
        return;
      }
      if (expiresAt) {
        const exp = new Date(`${expiresAt}:00-03:00`);
        if (Number.isNaN(exp.getTime()) || exp <= new Date()) {
          setMessage("Informe um prazo futuro para a reserva.");
          return;
        }
        form.set("expiresAt", expiresAt);
      }
      form.set("payment", receiptPayment.trim());
      form.set("amount", moneyInput(depositVal));
      form.set("deposit", moneyInput(depositVal));
      if (price) {
        form.set("price", price);
        form.set("total", price);
      }
    }

    startTransition(async () => {
      try {
        const result = await saveCommercial(vehicleId, form);
        setMessage(result.message);
        if (result.ok) router.refresh();
        if (result.documentId) {
          const file = await fetchDocFile(result.documentId, kind, result.documentNumber);
          const doc: GeneratedDoc = { id: result.documentId, kind, number: result.documentNumber, file };
          setLastDoc(doc);
          setSessionDocs((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
          if (kind === "recibo" && !selectedMethods.includes("sinal")) {
            setSelectedMethods((prev) => [...prev, "sinal"]);
          }
        }
      } catch {
        setMessage("Falha ao gerar documento. Tente novamente.");
      }
    });
  }

  const customerIdField = useId();

  return (
    <Card title="Contrato de compra e venda e recibo de sinal">
      <div className="space-y-4 font-body">
        <p className="text-sm text-muted">
          Vendedora: <strong>Garagem Motorcycle Ltda</strong>. O recibo de sinal fica separado e seu valor é descontado do total no contrato.
        </p>

        {message ? (
          <p role="status" aria-live="polite" className="text-sm text-brand-light font-medium">
            {message}
          </p>
        ) : null}

        <fieldset disabled={isPending} className="space-y-4 min-w-0">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Veículo do estoque" required as="div">
              <SearchSelect
                name="vehicleId"
                value={vehicleId}
                selectedLabel={
                  pickedVehicle
                    ? `${pickedVehicle.brand} ${pickedVehicle.model}${pickedVehicle.version ? ` ${pickedVehicle.version}` : ""}${pickedVehicle.plate ? ` (${formatPlateDisplay(pickedVehicle.plate)})` : ""} · ${pickedVehicle.yearModel} · ${formatCurrencyBRL(pickedVehicle.price)}`
                    : ""
                }
                placeholder="Marca, modelo ou placa"
                emptyText="Nenhum veículo disponível"
                loadOptions={loadVehicleOptions}
                onChange={(id, item) => {
                  setVehicleId(id);
                  if (item) {
                    setPickedVehicle(item);
                    const nextPrice = moneyInput(item.price);
                    if (!price || price === "0,00") {
                      setPrice(nextPrice);
                      if (selectedMethods.length === 1 && selectedMethods[0] === "pix" && (!pixAmount || pixAmount === "0,00")) {
                        setPixAmount(nextPrice);
                      }
                    }
                  } else {
                    setPickedVehicle(null);
                  }
                }}
              />
            </Field>

            <div className="space-y-1 text-sm">
              <label htmlFor={customerIdField} className="block text-sm font-medium">
                Cliente cadastrado <span className="text-brand">*</span>
              </label>
              <SearchSelect
                id={customerIdField}
                name="customerId"
                value={customerId}
                selectedLabel={
                  pickedCustomer
                    ? `${pickedCustomer.name}${pickedCustomer.phone ? ` · ${formatPhoneBR(pickedCustomer.phone)}` : ""}${pickedCustomer.cpf ? ` · CPF ${pickedCustomer.cpf}` : ""}`
                    : ""
                }
                placeholder="Nome, telefone ou CPF"
                emptyText="Nenhum cliente encontrado"
                loadOptions={loadCustomerOptions}
                onChange={(id, item) => {
                  setCustomerId(id);
                  setPickedCustomer(item ? { id, name: item.name ?? item.label, phone: item.phone ?? "", cpf: item.cpf ?? null } : null);
                }}
              />
              <a href="/admin/clientes" target="_blank" rel="noopener noreferrer" className="block text-xs text-muted underline">
                Cadastrar novo cliente
              </a>
            </div>

            <Field label="Valor total do veículo (R$)" required>
              <input
                name="price"
                inputMode="decimal"
                value={price}
                onChange={(e) => {
                  const val = moneyTyping(e.target.value);
                  setPrice(val);
                  if (selectedMethods.length === 1 && selectedMethods[0] === "pix") {
                    setPixAmount(val);
                  }
                }}
                placeholder="0,00"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-cream">
                Formas de pagamento do contrato <span className="text-brand">*</span>
                <span className="ml-1.5 text-xs font-normal text-muted">(marque uma ou mais)</span>
              </span>
              {totalPrice > 0 ? (
                <span
                  data-testid="payment-sum-status"
                  className={`text-xs font-medium px-2 py-1 border ${
                    sumMatches
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  }`}
                >
                  Soma: {formatCurrencyBRL(paymentsSum)} de {formatCurrencyBRL(totalPrice)}
                  {!sumMatches
                    ? diff > 0
                      ? ` · faltam ${formatCurrencyBRL(diff)}`
                      : ` · passam ${formatCurrencyBRL(Math.abs(diff))}`
                    : " · Total confere"}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2" role="group" aria-label="Formas de pagamento">
              {CONTRACT_PAYMENT_METHODS.map((method) => {
                const active = selectedMethods.includes(method.id);
                return (
                  <button
                    key={method.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleMethod(method.id)}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-display font-semibold tracking-wide border transition touch-manipulation ${
                      active
                        ? "border-brand bg-brand text-white"
                        : "border-white/15 bg-ink text-cream hover:border-brand/60"
                    }`}
                  >
                    {method.label}
                  </button>
                );
              })}
            </div>

            {totalPrice > 0 && !sumMatches ? (
              <p role="alert" className="text-xs text-amber-300 font-medium">
                Aviso: a soma das formas de pagamento ({formatCurrencyBRL(paymentsSum)}) não bate com o valor total do veículo ({formatCurrencyBRL(totalPrice)}).
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {selectedMethods.includes("pix") ? (
                <div className="border border-white/10 bg-ink/40 p-3 space-y-2">
                  <p className="text-xs font-display font-semibold uppercase tracking-wider text-cream">À vista / PIX</p>
                  <Field label="Valor à vista / PIX (R$)" required>
                    <input
                      name="pixAmount"
                      inputMode="decimal"
                      value={pixAmount}
                      onChange={(e) => setPixAmount(moneyTyping(e.target.value))}
                      placeholder="0,00"
                      className={inputClass}
                    />
                  </Field>
                </div>
              ) : null}

              {selectedMethods.includes("sinal") ? (
                <div className="border border-white/10 bg-ink/40 p-3 space-y-2">
                  <p className="text-xs font-display font-semibold uppercase tracking-wider text-cream">Sinal (abatido do total)</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Valor do sinal (R$)" required>
                      <input
                        name="signalAmount"
                        inputMode="decimal"
                        value={deposit}
                        onChange={(e) => setDeposit(moneyTyping(e.target.value))}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Data do sinal">
                      <input
                        name="signalDate"
                        type="date"
                        value={signalDate}
                        onChange={(e) => setSignalDate(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {selectedMethods.includes("financiamento") ? (
                <div className="border border-white/10 bg-ink/40 p-3 space-y-2 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-display font-semibold uppercase tracking-wider text-cream">Financiamento</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className={btn.ghost} onClick={handleCalculateSimulation}>
                        Simular parcelas
                      </button>
                      {simulation ? (
                        <span className="text-xs text-cream">
                          <strong>{formatCurrencyBRL(simulation.installment)}</strong> ({months}x) · Juros: {formatCurrencyBRL(simulation.interest)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-5">
                    <Field label="Banco / Financeira" required>
                      <input
                        name="bank"
                        value={bank}
                        onChange={(e) => setBank(e.target.value)}
                        placeholder="Ex.: Santander, BV"
                        className={inputClass}
                        maxLength={160}
                      />
                    </Field>
                    <Field label="Entrada (R$)">
                      <input
                        name="downPayment"
                        inputMode="decimal"
                        value={downPayment}
                        onChange={(e) => {
                          setDownPayment(moneyTyping(e.target.value));
                          setSimulation(null);
                        }}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Valor financiado (R$)" required>
                      <input
                        name="financed"
                        inputMode="decimal"
                        value={financedAmount}
                        onChange={(e) => {
                          setFinancedAmount(moneyTyping(e.target.value));
                          setSimulation(null);
                        }}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Parcelas">
                      <input
                        name="months"
                        type="number"
                        min="1"
                        max="120"
                        value={months}
                        onChange={(e) => {
                          setMonths(e.target.value);
                          setSimulation(null);
                        }}
                        placeholder="48"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Taxa a.m. (%)">
                      <input
                        name="rate"
                        value={rate}
                        onChange={(e) => {
                          setRate(e.target.value);
                          setSimulation(null);
                        }}
                        placeholder="1,50"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {selectedMethods.includes("troca") ? (
                <div className="border border-white/10 bg-ink/40 p-3 space-y-2 sm:col-span-2">
                  <p className="text-xs font-display font-semibold uppercase tracking-wider text-cream">Troca (veículo na troca)</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field label="Veículo na troca (marca/modelo/ano)" required>
                      <input
                        name="tradeVehicle"
                        value={tradeVehicle}
                        onChange={(e) => setTradeVehicle(e.target.value)}
                        placeholder="Ex.: Fiat Palio 1.0 2015"
                        className={inputClass}
                        maxLength={120}
                      />
                    </Field>
                    <Field label="Placa do veículo na troca">
                      <input
                        name="tradePlate"
                        value={tradePlate}
                        onChange={(e) => setTradePlate(formatPlateInput(e.target.value))}
                        placeholder="ABC1D23"
                        className={inputClass}
                        maxLength={8}
                      />
                    </Field>
                    <Field label="Valor avaliado na troca (R$)" required>
                      <input
                        name="tradeAmount"
                        inputMode="decimal"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(moneyTyping(e.target.value))}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}

              {selectedMethods.includes("cartao") ? (
                <div className="border border-white/10 bg-ink/40 p-3 space-y-2">
                  <p className="text-xs font-display font-semibold uppercase tracking-wider text-cream">Cartão</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Valor no cartão (R$)" required>
                      <input
                        name="cardAmount"
                        inputMode="decimal"
                        value={cardAmount}
                        onChange={(e) => setCardAmount(moneyTyping(e.target.value))}
                        placeholder="0,00"
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Parcelas">
                      <input
                        name="cardInstallments"
                        type="number"
                        min="1"
                        max="36"
                        value={cardInstallments}
                        onChange={(e) => setCardInstallments(e.target.value)}
                        placeholder="1"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border border-white/10 bg-ink/30 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-display font-semibold uppercase tracking-wider text-cream">
                Recibo de sinal separado (arras)
              </p>
              <span className="text-xs text-muted">Reserva o veículo e abate do total no contrato</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Sinal recebido (R$)">
                <input
                  name="deposit"
                  inputMode="decimal"
                  value={deposit}
                  onChange={(e) => setDeposit(moneyTyping(e.target.value))}
                  placeholder="0,00"
                  className={inputClass}
                />
              </Field>
              <Field label="Forma de pagamento do sinal">
                <input
                  name="payment"
                  value={receiptPayment}
                  onChange={(e) => setReceiptPayment(e.target.value)}
                  placeholder="Ex.: Pix chave CNPJ"
                  className={inputClass}
                  maxLength={200}
                />
              </Field>
              <Field label="Prazo da reserva (Brasília)">
                <input
                  name="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <Field label="Condições, validade e observações" hint="Observações impressas no contrato e no recibo (nunca cortadas).">
            <textarea
              name="conditions"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="Ex.: Veículo entregue revisado. Transferência por conta do comprador em até 30 dias."
              maxLength={3000}
              rows={2}
              className={inputClass}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/10">
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleGenerateDoc("contrato")}
              className={btn.primary}
            >
              {isPending ? "Gerando…" : "Gerar contrato (PDF)"}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => handleGenerateDoc("recibo")}
              className={btn.outline}
            >
              {isPending ? "Gerando…" : "Gerar recibo de sinal (PDF)"}
            </button>

            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className={btn.ghost}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </fieldset>

        {lastDoc ? (
          <div className="rounded border border-brand/40 bg-brand/10 p-4 space-y-3">
            <p className="text-sm font-semibold text-cream">
              {lastDoc.kind === "recibo" ? "Recibo de sinal" : "Contrato de compra e venda"}{lastDoc.number ? ` nº ${lastDoc.number}` : ""} gerado!
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                className={btn.primary}
                href={`/api/admin/documentos/${lastDoc.id}?inline`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir PDF
              </a>
              <button
                type="button"
                className={btn.outline}
                onClick={() =>
                  shareDocFile(lastDoc, {
                    onFileDownloaded: (f) => setLastDoc((curr) => (curr ? { ...curr, file: f } : null)),
                    onError: (err) => setMessage(err),
                  })
                }
              >
                Compartilhar no WhatsApp
              </button>
            </div>
          </div>
        ) : null}

        {sessionDocs.length > 1 ? (
          <div className="space-y-2 pt-2 border-t border-white/10">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Documentos gerados nesta sessão
            </p>
            <ul className="space-y-1">
              {sessionDocs.map((doc) => (
                <li key={doc.id} className="text-xs">
                  <a
                    href={`/api/admin/documentos/${doc.id}?inline`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-brand"
                  >
                    {doc.kind === "recibo" ? "Recibo de sinal" : "Contrato"}{doc.number ? ` nº ${doc.number}` : ""} · Abrir PDF
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
