export type AdminSellInput = {
  buyerName?: string;
  buyerPhone?: string;
  salePrice?: number;
  paymentMethod?: string;
  notes?: string;
};

export type ParsedAdminSellInput =
  | { ok: true; mode: "simple"; input: AdminSellInput }
  | {
      ok: true;
      mode: "complete";
      input: AdminSellInput & {
        buyerName: string;
        buyerPhone: string;
        salePrice: number;
        paymentMethod: string;
      };
    }
  | { ok: false; message: string };

export function parseAdminSellInput(value: unknown): ParsedAdminSellInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, message: "Dados da venda inválidos." };
  }

  const record = value as Record<string, unknown>;
  const allowed = new Set([
    "buyerName",
    "buyerPhone",
    "salePrice",
    "paymentMethod",
    "notes",
  ]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    return { ok: false, message: "Dados da venda inválidos." };
  }

  const input: AdminSellInput = {};
  if (record.buyerName !== undefined) {
    if (typeof record.buyerName !== "string" || record.buyerName.length > 120) {
      return { ok: false, message: "Nome do comprador inválido." };
    }
    const buyerName = record.buyerName.trim();
    if (buyerName) input.buyerName = buyerName;
  }
  if (record.buyerPhone !== undefined) {
    if (typeof record.buyerPhone !== "string") {
      return { ok: false, message: "Telefone do comprador inválido." };
    }
    const buyerPhone = record.buyerPhone.replace(/\D/g, "");
    if (buyerPhone && (buyerPhone.length < 10 || buyerPhone.length > 13)) {
      return { ok: false, message: "Telefone do comprador inválido." };
    }
    if (buyerPhone) input.buyerPhone = buyerPhone;
  }
  if (record.salePrice !== undefined) {
    const cents =
      typeof record.salePrice === "number"
        ? Math.round(record.salePrice * 100)
        : Number.NaN;
    if (
      !Number.isFinite(record.salePrice) ||
      !Number.isSafeInteger(cents) ||
      cents <= 0
    ) {
      return { ok: false, message: "Valor da venda inválido." };
    }
    input.salePrice = cents / 100;
  }
  if (record.paymentMethod !== undefined) {
    if (
      typeof record.paymentMethod !== "string" ||
      record.paymentMethod.length > 120
    ) {
      return { ok: false, message: "Forma de pagamento inválida." };
    }
    const paymentMethod = record.paymentMethod.trim();
    if (paymentMethod) input.paymentMethod = paymentMethod;
  }
  if (record.notes !== undefined) {
    if (typeof record.notes !== "string" || record.notes.length > 2000) {
      return { ok: false, message: "Observações inválidas." };
    }
    input.notes = record.notes.trim() || undefined;
  }

  if (
    input.buyerName &&
    input.buyerPhone &&
    input.salePrice &&
    input.paymentMethod
  ) {
    return {
      ok: true,
      mode: "complete",
      input: {
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone,
        salePrice: input.salePrice,
        paymentMethod: input.paymentMethod,
        ...(input.notes ? { notes: input.notes } : {}),
      },
    };
  }
  return { ok: true, mode: "simple", input };
}
