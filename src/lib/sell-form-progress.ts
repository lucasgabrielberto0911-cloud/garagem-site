import { isValidBrazilPhone } from "@/lib/format";
import { normalizeBrazilPhone } from "@/lib/phone-br";

export const SELL_ESSENTIAL_TOTAL = 5;

export type SellFormProgressInput = {
  name: string;
  phone: string;
  brand: string;
  model: string;
  year: string;
  plate?: string;
  km?: string;
  notes?: string;
  photoCount?: number;
};

export type SellFormProgress = {
  contactCount: number;
  contactDone: boolean;
  vehicleCount: number;
  vehicleDone: boolean;
  essentialFilled: number;
  essentialTotal: number;
  percent: number;
  optionalCount: number;
  readyToSend: boolean;
  statusText: string;
};

export function validateSellYear(
  rawYear: string,
  maxYear = new Date().getFullYear() + 1,
): string | null {
  const year = rawYear.trim();
  if (!/^\d{4}$/.test(year)) {
    return "Digite o ano com 4 números, como 2021.";
  }
  const yearNumber = Number(year);
  if (yearNumber < 1950 || yearNumber > maxYear) {
    return `Informe um ano entre 1950 e ${maxYear}.`;
  }
  return null;
}

export function getSellFormProgress(
  input: SellFormProgressInput,
  maxYear = new Date().getFullYear() + 1,
): SellFormProgress {
  const hasName = input.name.trim().length >= 3;
  const phoneDigits = input.phone.replace(/\D/g, "");
  const hasPhone =
    isValidBrazilPhone(input.phone) && Boolean(normalizeBrazilPhone(phoneDigits));
  const hasBrand = input.brand.trim().length > 0;
  const hasModel = input.model.trim().length > 0;
  const hasYear = validateSellYear(input.year, maxYear) === null;

  const contactCount = Number(hasName) + Number(hasPhone);
  const vehicleCount = Number(hasBrand) + Number(hasModel) + Number(hasYear);
  const essentialFilled = contactCount + vehicleCount;
  const remaining = SELL_ESSENTIAL_TOTAL - essentialFilled;

  const optionalCount =
    Number(Boolean(input.plate?.trim())) +
    Number(Boolean(input.km?.trim())) +
    Number(Boolean(input.notes?.trim())) +
    Number((input.photoCount ?? 0) > 0);

  let statusText: string;
  if (essentialFilled === 0) {
    statusText = "Só 5 campos rápidos para pedir sua avaliação";
  } else if (remaining === 0) {
    statusText = "Tudo pronto para solicitar sua avaliação";
  } else if (remaining === 1) {
    statusText = "Falta só 1 campo essencial";
  } else {
    statusText = `Faltam ${remaining} campos essenciais`;
  }

  return {
    contactCount,
    contactDone: contactCount === 2,
    vehicleCount,
    vehicleDone: vehicleCount === 3,
    essentialFilled,
    essentialTotal: SELL_ESSENTIAL_TOTAL,
    percent: Math.round((essentialFilled / SELL_ESSENTIAL_TOTAL) * 100),
    optionalCount,
    readyToSend: remaining === 0,
    statusText,
  };
}
