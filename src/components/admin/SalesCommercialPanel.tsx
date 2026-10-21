"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCommercial } from "@/app/admin/veiculos/commercial-actions";
import { simulateFinancing } from "@/lib/admin-commercial";
import { fetchDocFile, shareDocFile } from "@/lib/commercial-client";
import { formatAdminMoney as formatCurrencyBRL, moneyInput, moneyTyping, parseMoneyBR } from "@/lib/admin-money";
import { formatPhoneBR, formatPlateDisplay } from "@/lib/format";
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

  const [price, setPrice] = useState(initialVehicle?.price ? moneyInput(initialVehicle.price) : "");
  const [payment, setPayment] = useState("À vista via Pix");
  const [downPayment, setDownPayment] = useState("");
  const [bank, setBank] = useState("");
  const [months, setMonths] = useState("48");
  const [rate, setRate] = useState("1,50");
  const [deposit, setDeposit] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [conditions, setConditions] = useState("");

  const [simulation, setSimulation] = useState<ReturnType<typeof simulateFinancing> | null>(null);
  const [message, setMessage] = useState("");
  const [lastDoc, setLastDoc] = useState<GeneratedDoc | null>(null);
  const [sessionDocs, setSessionDocs] = useState<GeneratedDoc[]>([]);

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
    const d = parseMoneyBR(downPayment) ?? parseMoneyBR(deposit) ?? 0;
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
    if (!payment.trim()) {
      setMessage("Informe a forma de pagamento.");
      return;
    }

    const form = new FormData();
    form.set("operation", "document");
    form.set("kind", kind);
    form.set("customerId", customerId);
    form.set("payment", payment.trim());
    if (conditions.trim()) form.set("conditions", conditions.trim());

    if (kind === "contrato") {
      const amountVal = parseMoneyBR(price);
      if (!amountVal || amountVal <= 0) {
        setMessage("Informe o valor do veículo.");
        return;
      }
      form.set("amount", price);
      if (downPayment) form.set("downPayment", downPayment);
      if (deposit) form.set("deposit", deposit);
      if (bank.trim()) form.set("bank", bank.trim());
      if (rate) form.set("rate", rate);
      if (months) form.set("months", months);
    } else {
      const depositVal = parseMoneyBR(deposit) || parseMoneyBR(price);
      if (!depositVal || depositVal <= 0) {
        setMessage("Informe o valor do sinal recebido.");
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
          Gere contrato de compra e venda e recibo de sinal para veículos do estoque.
          Vendedora: <strong>Garagem Motorcycle Ltda</strong>. O sinal é garantia (arras) e não é restituído em caso de desistência do comprador.
        </p>

        {message ? (
          <p role="status" aria-live="polite" className="text-sm text-brand-light font-medium">
            {message}
          </p>
        ) : null}

        <fieldset disabled={isPending} className="space-y-4 min-w-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Veículo do estoque" required as="div">
              <SearchSelect
                name="vehicleId"
                value={vehicleId}
                selectedLabel={
                  pickedVehicle
                    ? `${pickedVehicle.brand} ${pickedVehicle.model}${pickedVehicle.version ? ` ${pickedVehicle.version}` : ""}${pickedVehicle.plate ? ` (${formatPlateDisplay(pickedVehicle.plate)})` : ""} · ${pickedVehicle.yearModel} · ${formatCurrencyBRL(pickedVehicle.price)}`
                    : ""
                }
                placeholder="Busque por marca, modelo ou placa"
                emptyText="Nenhum veículo disponível"
                loadOptions={loadVehicleOptions}
                onChange={(id, item) => {
                  setVehicleId(id);
                  if (item) {
                    setPickedVehicle(item);
                    if (!price || price === "0,00") {
                      setPrice(moneyInput(item.price));
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
                placeholder="Busque por nome, telefone ou CPF"
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

            <Field label="Valor do veículo / Total negociado (R$)" required hint="Preço total acordado na negociação.">
              <input
                name="price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(moneyTyping(e.target.value))}
                placeholder="0,00"
                className={inputClass}
              />
            </Field>

            <Field label="Forma de pagamento" required hint="Ex.: À vista via Pix, Financiamento bancário, Cartão">
              <input
                name="payment"
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                placeholder="Ex.: À vista via Pix"
                className={inputClass}
                maxLength={200}
              />
            </Field>

            <Field label="Entrada total, incluindo sinal (R$)" hint="Soma do sinal com outros pagamentos de entrada.">
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

            <Field label="Banco / Financeira" hint="Instituição que financiará o saldo.">
              <input
                name="bank"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                placeholder="Ex.: Santander, BV, Itaú"
                className={inputClass}
                maxLength={160}
              />
            </Field>

            <Field label="Prazo do financiamento (meses)" hint="Número de parcelas.">
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

            <Field label="Taxa mensal (%)" hint="Taxa de juros estimada.">
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

            <Field label="Sinal recebido (R$)" hint="Valor recebido para reserva (arras).">
              <input
                name="deposit"
                inputMode="decimal"
                value={deposit}
                onChange={(e) => setDeposit(moneyTyping(e.target.value))}
                placeholder="0,00"
                className={inputClass}
              />
            </Field>

            <Field label="Prazo da reserva (horário de Brasília)" hint="Data limite da garantia da reserva.">
              <input
                name="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Condições, validade e observações" hint="Observações impressas no contrato e recibo (nunca cortadas).">
                <textarea
                  name="conditions"
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="Ex.: Veículo entregue revisado. Transferência por conta do comprador em até 30 dias."
                  maxLength={3000}
                  rows={3}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              className={btn.outline}
              onClick={handleCalculateSimulation}
            >
              Calcular parcelas
            </button>
            {simulation ? (
              <span className="text-xs text-cream">
                Parcela: <strong>{formatCurrencyBRL(simulation.installment)}</strong> ({months}x) · Total com entrada: {formatCurrencyBRL(simulation.total)} · Juros: {formatCurrencyBRL(simulation.interest)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
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
