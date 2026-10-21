"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCommercial } from "@/app/admin/veiculos/commercial-actions";
import { ENTRY_ITEMS, FINANCE_STATUSES, suggestPrice } from "@/lib/admin-commercial";
import { formatAdminMoney as brl, moneyInput, parseMoneyBR } from "@/lib/admin-money";
import { whatsappUrl } from "@/lib/leads";
import { SearchSelect } from "./SearchSelect";
import { btn, Card, inputClass } from "./ui";

const LEGACY_PAYMENT_METHODS = [{ id: "pix", label: "À vista/PIX" }, { id: "financiamento", label: "Financiamento" }, { id: "troca", label: "Troca" }, { id: "cartao", label: "Cartão" }] as const;

type Props = {
  vehicle: { id: string; chassis: string | null; renavam: string | null; status: string; price: number; purchasePrice: number | null; consigned: boolean; days: number; costs: number; sale: { id: string; salePrice: number; paymentMethod: string; customerId: string | null } | null };
  reservation: { customerId: string; customer: string; phone: string; deadline: string | null; deposit: number; expiresAt: string; status: string } | null;
  assessment: { items: { label: string; status: string }[]; notes: string; offer: number; approved: boolean } | null;
  simulations: { id: string; customerName: string; bank: string; installment: number; months: number; rate: number; status: string }[];
  documents: { id: string; kind: string; number: number; date: string; saleId?: string | null; customerId?: string | null; conditions?: string; signal?: { amount?: number; receiptId?: string; date?: string } }[];
  history: { price: number; date: string }[];
};

function Field({ label, name, value, type = "text", required = true }: { label: string; name: string; value?: string | number; type?: string; required?: boolean }) {
  return <label className="block space-y-1 text-sm"><span>{label}</span><input name={name} type={type} defaultValue={value} required={required} maxLength={type === "text" ? 200 : undefined} className={inputClass} /></label>;
}

export function CommercialPanel({ vehicle, reservation, assessment, simulations, documents, history }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [margin, setMargin] = useState("2.000,00");
  const sale = vehicle.sale;
  const previousContract = sale?.customerId ? documents.find((document) => document.kind === "contrato" && document.saleId === sale.id && document.customerId === sale.customerId) : undefined;
  const previousSignal = previousContract?.signal;
  const suggestion = suggestPrice({ price: vehicle.price, purchase: vehicle.purchasePrice, costs: vehicle.costs, days: vehicle.days, margin: parseMoneyBR(margin) ?? 0, consigned: vehicle.consigned });
  function submit(form: FormData) {
    // RG vazio na ficha = manter o do cadastro (o cliente é escolhido aqui, sem prefill).
    if (!String(form.get("rg") ?? "").trim()) form.delete("rg");
    if (form.get("operation") === "document" && form.get("kind") === "contrato") {
      const signalAmount = reservation?.deposit || parseMoneyBR(form.get("legacySignalAmount")) || 0;
      const selectedMethods = new Set(form.getAll("legacyPaymentMethod").map(String));
      form.set("payments", JSON.stringify([
        ...(signalAmount > 0 ? [{ method: "sinal", amount: signalAmount, signalDate: previousSignal?.date }] : []),
        ...LEGACY_PAYMENT_METHODS.filter(({ id }) => selectedMethods.has(id)).map(({ id }) => ({
          method: id,
          amount: parseMoneyBR(form.get(`legacyPaymentAmount_${id}`)) ?? 0,
          ...(id === "troca" ? { tradeVehicle: form.get("legacyTradeVehicle"), tradePlate: form.get("legacyTradePlate") } : {}),
          ...(id === "cartao" ? { installments: Number(form.get("legacyInstallments_cartao")) } : {}),
          ...(id === "financiamento" ? {
            downPayment: parseMoneyBR(form.get("legacyDownPayment")) ?? 0,
            installments: Number(form.get("legacyInstallments_financiamento")),
          } : {}),
        })),
      ]));
    }
    start(async () => {
      try {
        const result = await saveCommercial(vehicle.id, form);
        setMessage(result.message);
        if (result.ok) router.refresh();
      } catch { setMessage("Falha de conexão. Confira o registro antes de tentar novamente."); }
    });
  }
  function openCard(id: string) {
    const el = document.getElementById(id) as HTMLDetailsElement | null;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const bar = "inline-flex min-h-11 flex-1 items-center justify-center px-2 text-center text-xs font-semibold touch-manipulation";
  return <div className="space-y-4 pb-16 font-body md:pb-0">
    <nav aria-label="Ações rápidas" className="fixed inset-x-0 bottom-admin-nav z-30 flex gap-2 border-t border-white/10 bg-asphalt p-2 md:hidden">
      <button type="button" className={`${btn.primary} ${bar}`} onClick={() => openCard("reserva")} disabled={vehicle.status !== "disponivel"}>Reservar</button>
      {reservation ? <a className={`${btn.outline} ${bar}`} href={whatsappUrl(reservation.phone, `Olá, ${reservation.customer.split(" ")[0]}! Aqui é da Garagem.`)} target="_blank" rel="noopener noreferrer">WhatsApp do cliente</a> : null}
    </nav>
    <p role="status" aria-live="polite" className="text-sm">{pending ? "Salvando…" : message}</p>
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      <Card title="Sugestão de preço por giro" collapsed>
        <p className="mb-3 text-sm text-muted">{vehicle.days} dias no estoque. Redução de 1% após 30 dias, 3% após 60 e 5% após 90. Piso: compra + custos + margem mínima.</p>
        <form action={submit} className="space-y-3">
          <input type="hidden" name="operation" value="price" />
          <label className="block text-sm">Margem mínima (R$)<input className={inputClass} name="margin" value={margin} onChange={(e) => setMargin(e.target.value)} inputMode="decimal" required /></label>
          {suggestion ? <p className="text-sm">Sugestão: {brl(suggestion.price)} · piso {brl(suggestion.floor)} · variação {brl(suggestion.difference)}</p> : <p className="text-sm text-muted">Informe o custo de compra. Consignados exigem negociação com o proprietário.</p>}
          <button className={btn.primary} disabled={!suggestion || suggestion.price >= vehicle.price || vehicle.status === "vendido"}>Aplicar redução e registrar histórico</button>
        </form>
        <ul className="mt-3 text-xs text-muted">{history.map((h, i) => <li key={i}>{h.date} · {brl(h.price)}</li>)}</ul>
      </Card>
      <Card id="reserva" title="Reserva com sinal e prazo" collapsed>
        <p className="mb-3 text-xs text-muted">Reservas vencidas são liberadas em até 1 minuto com o painel aberto ou na rotina diária às 6h.</p>
        {reservation ? <p className="mb-3 text-sm">{reservation.customer} · sinal {brl(reservation.deposit)} · prazo {reservation.expiresAt} · {reservation.status}{reservation.deadline ? ` · ${reservation.deadline}` : ""}. O sinal integra o valor total da venda; não some novamente.</p> : null}
        {reservation?.status === "ativa" ? <><form action={submit}><input type="hidden" name="operation" value="cancel-reservation" /><p className="mb-2 text-xs text-muted">Cancelar libera o veículo. A devolução do sinal deve ser acertada com o cliente.</p><button className={btn.outline}>Cancelar reserva e liberar veículo</button></form>{reservation.deposit > 0 && <form action={submit} className="mt-3 flex flex-wrap items-end gap-2"><input type="hidden" name="operation" value="document" /><input type="hidden" name="kind" value="recibo" /><input type="hidden" name="customerId" value={reservation.customerId} /><input type="hidden" name="amount" value={moneyInput(reservation.deposit)} /><input type="hidden" name="payment" value="Sinal" /><button className={btn.outline}>Emitir recibo do sinal</button></form>}<form action={submit} className="mt-3 space-y-2"><input type="hidden" name="operation" value="extend-reservation" /><Field label="Novo prazo (horário de Brasília)" name="expiresAt" type="datetime-local" /><button className={btn.outline}>Prorrogar reserva</button></form><a className={`${btn.primary} mt-2`} href={`/admin/vendas/nova?veiculo=${vehicle.id}`}>Iniciar venda (sinal incluído)</a></> : vehicle.status === "disponivel" ? <form action={submit} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="operation" value="reserve" /><CustomerSelect />
          <Field label="Sinal recebido (R$)" name="deposit" value="0,00" /><Field label="Prazo (horário de Brasília)" name="expiresAt" type="datetime-local" />
          <button className={btn.primary}>Confirmar reserva</button>
        </form> : <p className="text-sm text-muted">Reserva exige veículo disponível.</p>}
      </Card>
      <Card title="Checklist de entrada e avaliação do usado" collapsed>
        <p className="mb-3 text-sm text-muted">Fotos, laudos e comprovantes ficam na operação abaixo. Aprovar grava a oferta como custo de compra e atualiza chave e manual.</p>
        <form action={submit} className="space-y-3"><input type="hidden" name="operation" value="assessment" />
          <div className="grid gap-3 sm:grid-cols-2">{ENTRY_ITEMS.map((label, index) => <label key={label} className="text-sm">{label}<select name={`item${index}`} className={inputClass} defaultValue={assessment?.items[index]?.status ?? "pendente"}><option value="pendente">Pendente</option><option value="ok">OK</option><option value="atencao">Exige atenção</option><option value="na">Não se aplica</option></select></label>)}</div>
          <Field label="Oferta / custo de aquisição (R$)" name="offer" value={moneyInput(assessment?.offer ?? vehicle.purchasePrice)} />
          <label className="block text-sm">Pendências e custos previstos<textarea name="notes" maxLength={4000} defaultValue={assessment?.notes} className={inputClass} /></label>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="approved" defaultChecked={assessment?.approved} />Aprovar avaliação concluída</label>
          <button className={btn.primary}>Salvar avaliação</button>
        </form>
      </Card>
      <Card title="Histórico de simulações de financiamento" collapsed>
        <div className="mt-4 space-y-3">{simulations.map((s) => <form key={s.id} action={submit} className="space-y-2 border-t border-white/10 pt-3"><input type="hidden" name="operation" value="finance-status" /><input type="hidden" name="simulationId" value={s.id} /><p className="text-sm">{s.customerName} · {s.bank} · {s.months} × {brl(s.installment)} · {s.rate}% a.m.</p><label className="block text-sm">Situação<select name="status" className={inputClass} defaultValue={s.status}>{FINANCE_STATUSES.map((value, index) => <option key={value} value={value}>{["Simulação", "Enviada ao banco", "Aprovada", "Recusada"][index]}</option>)}</select></label><button className={btn.outline}>Atualizar acompanhamento</button></form>)}</div>
      </Card>
      <Card title="Contratos e recibos gerados" collapsed>
        {vehicle.sale && <form action={submit} className="mb-4 space-y-3 border-b border-white/10 pb-4"><input type="hidden" name="operation" value="document" /><input type="hidden" name="kind" value="contrato" /><input type="hidden" name="amount" value={moneyInput(vehicle.sale.salePrice)} /><Field label="Sinal já recebido (R$)" name="legacySignalAmount" value={moneyInput(reservation?.deposit || previousSignal?.amount || 0)} required={false} />{previousSignal?.receiptId && <input type="hidden" name="legacySignalReceiptId" value={previousSignal.receiptId} />}{vehicle.sale.customerId ? <><input type="hidden" name="customerId" value={vehicle.sale.customerId} /><p className="text-sm">Comprador atual da venda.</p></> : <CustomerSelect />}<fieldset className="space-y-2"><legend className="text-sm">Pagamentos reais do saldo</legend>{LEGACY_PAYMENT_METHODS.map(({ id, label }, index) => <div key={id} className="grid gap-2 sm:grid-cols-[1fr_1fr]"><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="legacyPaymentMethod" value={id} defaultChecked={index === 0} />{label}</label><Field label={`Valor · ${label}`} name={`legacyPaymentAmount_${id}`} value={index === 0 ? moneyInput(vehicle.sale!.salePrice - (reservation?.deposit || previousSignal?.amount || 0)) : ""} required={false} />{id === "troca" && <><Field label="Veículo/descrição da troca" name="legacyTradeVehicle" required={false} /><Field label="Placa da troca" name="legacyTradePlate" required={false} /></>}{id === "cartao" && <Field label="Parcelas no cartão" name="legacyInstallments_cartao" type="number" required={false} />}{id === "financiamento" && <><Field label="Entrada do financiamento (R$)" name="legacyDownPayment" required={false} /><Field label="Parcelas do financiamento" name="legacyInstallments_financiamento" type="number" required={false} /></>}</div>)}</fieldset><p className="text-xs text-muted">{reservation && reservation.deposit > 0 ? `Sinal da reserva: ${brl(reservation.deposit)}. ` : ""}Informe os valores por forma de pagamento; a soma deve fechar o total da venda.</p><Field label="Chassi" name="chassis" value={vehicle.chassis ?? ""} required={false} /><Field label="RENAVAM" name="renavam" value={vehicle.renavam ?? ""} required={false} /><Field label="RG do cliente" name="rg" required={false} /><label className="block text-sm">Condições adicionais<textarea name="conditions" maxLength={3000} defaultValue={previousContract?.conditions ?? ""} className={inputClass} /></label><button className={btn.primary}>{documents.some((document) => document.kind === "contrato") ? "Emitir nova versão do contrato" : "Emitir contrato desta venda"}</button></form>}
        <ul className="mt-3 space-y-2">{documents.map((d) => <li key={d.id}><a className={btn.outline} href={`/api/admin/documentos/${d.id}?inline`} target="_blank" rel="noopener noreferrer">{d.kind === "recibo" ? "Recibo" : d.kind === "contrato" ? "Contrato" : "Proposta"}{d.number ? ` nº ${d.number}` : ""} · {d.date} · Abrir PDF</a></li>)}</ul>
      </Card>
    </fieldset>
  </div>;
}

export function CustomerSelect({
  value,
  selectedLabel,
  onChange,
}: {
  value?: string;
  selectedLabel?: string;
  onChange?: (id: string, item?: { id: string; label: string }) => void;
} = {}) {
  const id = useId();
  const [internal, setInternal] = useState({ id: "", label: "" });
  const currentId = value !== undefined ? value : internal.id;
  const currentLabel = selectedLabel !== undefined ? selectedLabel : internal.label;
  return <div className="space-y-1 text-sm"><label htmlFor={id}>Cliente cadastrado</label><SearchSelect id={id}
    name="customerId" value={currentId} selectedLabel={currentLabel} placeholder="Busque nome, telefone ou CPF"
    onChange={(id, item) => {
      setInternal({ id, label: item?.label ?? "" });
      onChange?.(id, item ? { id: item.id, label: item.label } : undefined);
    }}
    loadOptions={async (query, signal) => {
      const response = await fetch(`/api/admin/clientes?q=${encodeURIComponent(query)}&take=20`, { signal });
      if (!response.ok) throw new Error("Falha ao buscar clientes.");
      const data = await response.json() as { customers: { id: string; name: string; phone: string }[] };
      return data.customers.map((c) => ({ id: c.id, label: `${c.name} · ${c.phone}` }));
    }}
  /><a href="/admin/clientes" className="block text-xs text-muted underline">Cadastrar cliente</a></div>;
}
