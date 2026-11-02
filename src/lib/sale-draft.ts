import { CONTRACT_PAYMENT_METHODS, type ContractPaymentItem } from "./admin-commercial";

/** Lista fechada: nunca copia cliente, documentos, contatos ou texto livre. */
export function saleDraftFields(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const money = (value: unknown) => typeof value === "string" && /^[\d.,\s]*$/.test(value) ? value : "";
  const id = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : null;
  const payments: ContractPaymentItem[] = [];
  if (Array.isArray(source.payments)) for (const item of source.payments) {
    if (!item || typeof item !== "object" || !CONTRACT_PAYMENT_METHODS.some(method => method.id === item.method)) continue;
    const payment: ContractPaymentItem = { method: item.method, amount: Number.isFinite(item.amount) ? item.amount : 0 };
    for (const key of ["downPayment", "installments", "installmentAmount"] as const) {
      if (typeof item[key] === "number" && Number.isFinite(item[key])) payment[key] = item[key];
    }
    if (Array.isArray(item.noteIds)) payment.noteIds = item.noteIds.filter((id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(id));
    if (Array.isArray(item.notes)) payment.notes = item.notes.flatMap((note: Record<string, unknown> | null) => {
      if (!note || typeof note.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(note.id)
        || typeof note.number !== "number" || !Number.isInteger(note.number)
        || typeof note.amount !== "number" || !Number.isFinite(note.amount)
        || typeof note.dueDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(note.dueDate)) return [];
      return [{ id: note.id, number: note.number, amount: note.amount, dueDate: note.dueDate }];
    });
    payments.push(payment);
  }
  return {
    vehicleId: id(source.vehicleId), customerId: id(source.customerId),
    stage: typeof source.stage === "number" && Number.isInteger(source.stage) ? Math.min(4, Math.max(0, source.stage)) : 0,
    total: money(source.total), commission: money(source.commission),
    signal: source.signal === true, includeProposal: source.includeProposal === true,
    payments,
  };
}

/** Também protege a leitura de rascunhos gravados por versões anteriores. */
export function safeAdminDraftPayload(key: string, payload: unknown) {
  if (!key.startsWith("sale:")) return payload;
  const fields = payload && typeof payload === "object" && "fields" in payload ? payload.fields : undefined;
  return { fields: saleDraftFields(fields) };
}
