import { WHATSAPP_BRAND, whatsappUrl } from "@/lib/site";

export type ChatVisitInput = {
  vehicle: string;
  questions: string;
  time: string;
};

function clean(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function isChatVisitComplete(input: ChatVisitInput) {
  return clean(input.vehicle, 120).length > 0 && clean(input.time, 80).length > 0;
}

/** Mensagem pronta: carro, dúvidas e horário. Não cita local nem endereço. */
export function chatVisitMessage(input: ChatVisitInput) {
  const vehicle = clean(input.vehicle, 120);
  const questions = clean(input.questions, 300);
  const time = clean(input.time, 80);
  const parts = [`Oi! Vim pelo chat do site da ${WHATSAPP_BRAND} e quero marcar uma visita.`];
  if (vehicle) parts.push(`Carro de interesse: ${vehicle}.`);
  if (questions) parts.push(`Dúvidas: ${questions}.`);
  if (time) parts.push(`Horário desejado: ${time}.`);
  return parts.join(" ");
}

export function chatVisitWhatsAppUrl(input: ChatVisitInput) {
  return whatsappUrl(chatVisitMessage(input), {
    campaign: "chat",
    content: "chat-visita",
  });
}
