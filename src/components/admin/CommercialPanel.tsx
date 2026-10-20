"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCommercial } from "@/app/admin/veiculos/commercial-actions";
import { ENTRY_ITEMS, FINANCE_STATUSES, simulateFinancing, suggestPrice } from "@/lib/admin-commercial";
import { formatAdminMoney as brl, moneyInput, parseMoneyBR } from "@/lib/admin-money";
import { whatsappUrl } from "@/lib/leads";
import { SearchSelect } from "./SearchSelect";
import { btn, Card, inputClass } from "./ui";

type Props = {
  vehicle: { id: string; status: string; price: number; fipePrice: number | null; purchasePrice: number | null; consigned: boolean; days: number; costs: number };
  reservation: { customer: string; phone: string; deadline: string | null; deposit: number; expiresAt: string; status: string } | null;
  assessment: { items: { label: string; status: string }[]; notes: string; offer: number; approved: boolean } | null;
  simulations: { id: string; customerName: string; bank: string; installment: number; months: number; rate: number; status: string }[];
  documents: { id: string; kind: string; number: number; date: string }[];
  history: { price: number; date: string }[];
};

function Field({ label, name, value, type = "text", required = true }: { label: string; name: string; value?: string | number; type?: string; required?: boolean }) {
  return <label className="block space-y-1 text-sm"><span>{label}</span><input name={name} type={type} defaultValue={value} required={required} maxLength={type === "text" ? 200 : undefined} className={inputClass} /></label>;
}

async function fetchDocFile(id: string, kind: string, number?: number) {
  try {
    const r = await fetch(`/api/admin/documentos/${id}`);
    if (!r.ok || !r.headers.get("content-type")?.includes("application/pdf")) return null;
    return new File([await r.blob()], `garagem-${kind}-${number}.pdf`, { type: "application/pdf" });
  } catch { return null; }
}

export function CommercialPanel({ vehicle, reservation, assessment, simulations, documents, history }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [margin, setMargin] = useState("2.000,00");
  const [simulation, setSimulation] = useState<ReturnType<typeof simulateFinancing> | null>(null);
  const [lastDoc, setLastDoc] = useState<{ id: string; kind: string; number?: number; file: File | null } | null>(null);
  const suggestion = suggestPrice({ price: vehicle.price, fipe: vehicle.fipePrice, purchase: vehicle.purchasePrice, costs: vehicle.costs, days: vehicle.days, margin: parseMoneyBR(margin) ?? 0, consigned: vehicle.consigned });
  function submit(form: FormData) {
    start(async () => {
      try {
        const result = await saveCommercial(vehicle.id, form);
        setMessage(result.message);
        if (result.ok) router.refresh();
        if (result.documentId) {
          const kind = String(form.get("kind"));
          // Baixa o PDF já aqui para o botão de compartilhar abrir direto no gesto do toque (iOS).
          const file = await fetchDocFile(result.documentId, kind, result.documentNumber);
          setLastDoc({ id: result.documentId, kind, number: result.documentNumber, file });
          if (!file) setMessage("Operação registrada, mas o PDF não pôde ser baixado. Use “Compartilhar” para tentar de novo.");
        }
      } catch { setMessage("Falha de conexão. Confira o registro antes de tentar novamente."); }
    });
  }
  function openCard(id: string) {
    const el = document.getElementById(id) as HTMLDetailsElement | null;
    if (!el) return;
    el.open = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function shareDoc(doc: NonNullable<typeof lastDoc>) {
    if (!doc.file) {
      const file = await fetchDocFile(doc.id, doc.kind, doc.number);
      if (!file) { setMessage("Não foi possível baixar o PDF. Tente novamente."); return; }
      setMessage("");
      setLastDoc({ ...doc, file });
      return;
    }
    const label = `${doc.kind === "recibo" ? "Recibo" : "Proposta"}${doc.number ? ` nº ${doc.number}` : ""} - Garagem`;
    if (doc.file && navigator.canShare?.({ files: [doc.file] })) navigator.share({ files: [doc.file], title: label, text: label }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(label)}`, "_blank", "noopener");
  }
  const bar = "inline-flex min-h-11 flex-1 items-center justify-center px-2 text-center text-xs font-semibold touch-manipulation";
  return <div className="space-y-4 pb-16 font-body md:pb-0">
    <nav aria-label="Ações rápidas" className="fixed inset-x-0 bottom-admin-nav z-30 flex gap-2 border-t border-white/10 bg-asphalt p-2 md:hidden">
      <button type="button" className={`${btn.primary} ${bar}`} onClick={() => openCard("reserva")} disabled={vehicle.status !== "disponivel"}>Reservar</button>
      <button type="button" className={`${btn.outline} ${bar}`} onClick={() => openCard("proposta")}>Gerar proposta</button>
      {reservation ? <a className={`${btn.outline} ${bar}`} href={whatsappUrl(reservation.phone, `Olá, ${reservation.customer.split(" ")[0]}! Aqui é da Garagem.`)} target="_blank" rel="noopener noreferrer">WhatsApp do cliente</a> : null}
    </nav>
    <p role="status" aria-live="polite" className="text-sm">{pending ? "Salvando…" : message}</p>
    <fieldset disabled={pending} className="min-w-0 space-y-4">
      <Card title="Sugestão de preço por giro" collapsed>
        <p className="mb-3 text-sm text-muted">{vehicle.days} dias no estoque · FIPE {vehicle.fipePrice ? brl(vehicle.fipePrice) : "não informada"}. Redução de 1% após 30 dias, 3% após 60 e 5% após 90. Piso: compra + custos + margem mínima.</p>
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
        {reservation?.status === "ativa" ? <><form action={submit}><input type="hidden" name="operation" value="cancel-reservation" /><p className="mb-2 text-xs text-muted">Cancelar libera o veículo. A devolução do sinal deve ser acertada com o cliente.</p><button className={btn.outline}>Cancelar reserva e liberar veículo</button></form><form action={submit} className="mt-3 space-y-2"><input type="hidden" name="operation" value="extend-reservation" /><Field label="Novo prazo (horário de Brasília)" name="expiresAt" type="datetime-local" /><button className={btn.outline}>Prorrogar reserva</button></form><a className={`${btn.primary} mt-2`} href={`/admin/vendas?vehicle=${vehicle.id}`}>Registrar venda (sinal incluído)</a></> : vehicle.status === "disponivel" ? <form action={submit} className="grid gap-3 sm:grid-cols-2">
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
      <Card title="Simulador e acompanhamento de financiamento" collapsed>
        <p className="mb-3 text-sm text-muted">Tabela Price, taxa mensal informada pelo vendedor. Estimativa sem IOF, seguros e tarifas; não representa CET nem aprovação de crédito.</p>
        <form action={submit} onChange={() => setSimulation(null)} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="operation" value="finance" />
          <Field label="Cliente" name="customerName" /><Field label="Banco / financeira" name="bank" />
          <Field label="Valor do veículo (R$)" name="price" value={moneyInput(vehicle.price)} /><Field label="Entrada total, incluindo sinal (R$)" name="downPayment" value={moneyInput(reservation?.deposit ?? 0)} />
          <Field label="Taxa mensal (%)" name="rate" value="1,50" /><Field label="Prazo (meses)" name="months" value={48} type="number" />
          <button type="button" className={btn.outline} onClick={(event) => { const form = new FormData(event.currentTarget.form!); try { setSimulation(simulateFinancing(parseMoneyBR(form.get("price")) ?? NaN, parseMoneyBR(form.get("downPayment")) ?? NaN, Number(String(form.get("rate")).replace(",", ".")), Number(form.get("months")))); } catch (error) { setMessage((error as Error).message); } }}>Calcular parcelas</button>
          <button className={btn.primary}>Salvar simulação</button>
          {simulation ? <p className="text-sm sm:col-span-2">Parcela: {brl(simulation.installment)} · total com entrada: {brl(simulation.total)} · juros estimados: {brl(simulation.interest)}</p> : null}
        </form>
        <div className="mt-4 space-y-3">{simulations.map((s) => <form key={s.id} action={submit} className="space-y-2 border-t border-white/10 pt-3"><input type="hidden" name="operation" value="finance-status" /><input type="hidden" name="simulationId" value={s.id} /><p className="text-sm">{s.customerName} · {s.bank} · {s.months} × {brl(s.installment)} · {s.rate}% a.m.</p><label className="block text-sm">Situação<select name="status" className={inputClass} defaultValue={s.status}>{FINANCE_STATUSES.map((value, index) => <option key={value} value={value}>{["Simulação", "Enviada ao banco", "Aprovada", "Recusada"][index]}</option>)}</select></label><button className={btn.outline}>Atualizar acompanhamento</button></form>)}</div>
      </Card>
      <Card id="proposta" title="Proposta e recibo em PDF" collapsed>
        <p className="mb-3 text-sm text-muted">Documento de apoio à negociação. Confira dados e condições antes de assinar. O recibo declara valor já recebido e recebe número sequencial.</p>
        <form action={submit} className="grid gap-3 sm:grid-cols-2"><input type="hidden" name="operation" value="document" />
          <label className="block text-sm">Documento<select name="kind" className={inputClass}><option value="proposta">Proposta</option><option value="recibo">Recibo (sinal, complemento, entrada ou quitação)</option></select></label><CustomerSelect />
          <Field label="Valor proposto / recebido (R$)" name="amount" /><Field label="Forma de pagamento" name="payment" />
          <label className="block text-sm sm:col-span-2">Condições, validade e observações<textarea name="conditions" required maxLength={3000} className={inputClass} /></label><button className={btn.primary}>Gerar PDF</button>
          {lastDoc ? <div className="flex flex-wrap gap-2 sm:col-span-2"><a className={btn.primary} href={`/api/admin/documentos/${lastDoc.id}?inline`} target="_blank" rel="noopener noreferrer">Abrir PDF</a><button type="button" className={btn.outline} onClick={() => shareDoc(lastDoc)}>Compartilhar no WhatsApp</button></div> : null}
        </form>
        <ul className="mt-3 space-y-2">{documents.map((d) => <li key={d.id}><a className={btn.outline} href={`/api/admin/documentos/${d.id}?inline`} target="_blank" rel="noopener noreferrer">{d.kind === "recibo" ? "Recibo" : "Proposta"} nº {d.number} · {d.date} · Abrir PDF</a></li>)}</ul>
      </Card>
    </fieldset>
  </div>;
}

function CustomerSelect() {
  const id = useId();
  const [selected, setSelected] = useState({ id: "", label: "" });
  return <div className="space-y-1 text-sm"><label htmlFor={id}>Cliente cadastrado</label><SearchSelect id={id}
    name="customerId" value={selected.id} selectedLabel={selected.label} placeholder="Busque nome, telefone ou CPF"
    onChange={(id, item) => setSelected({ id, label: item?.label ?? "" })}
    loadOptions={async (query, signal) => {
      const response = await fetch(`/api/admin/clientes?q=${encodeURIComponent(query)}&take=20`, { signal });
      if (!response.ok) throw new Error("Falha ao buscar clientes.");
      const data = await response.json() as { customers: { id: string; name: string; phone: string }[] };
      return data.customers.map((c) => ({ id: c.id, label: `${c.name} · ${c.phone}` }));
    }}
  /><a href="/admin/clientes" className="block text-xs text-muted underline">Cadastrar cliente</a></div>;
}
