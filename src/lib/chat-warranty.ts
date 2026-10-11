import { STORE_WARRANTY } from "@/lib/vehicle-conditions";

/**
 * Garantia oficial da loja para o chat, sempre a partir do texto do site
 * (`STORE_WARRANTY`): o encaminhamento final para WhatsApp sai, o resto fica como está.
 */
export function officialWarrantyDetail() {
  const sentences = STORE_WARRANTY.body
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim() && !/whatsapp/i.test(sentence));
  return sentences.join(" ").trim();
}

/** "Garantia comercial de 3 meses para motor e câmbio em todos os seminovos." */
export const OFFICIAL_WARRANTY_SUMMARY = STORE_WARRANTY.summary;
