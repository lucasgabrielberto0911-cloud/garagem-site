"use client";

import { useState } from "react";
import { IconWhatsApp } from "@/components/site/icons";
import {
  chatVisitWhatsAppUrl,
  isChatVisitComplete,
  type ChatVisitInput,
} from "@/lib/chat-visit";
import { trackWhatsAppClick } from "@/lib/meta-pixel";
import { trackEvent } from "@/lib/track-event";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-[#1B1B20] px-3 py-2 text-[13px] text-cream placeholder:text-cream/40 focus:border-white/25 focus:outline-none";

/** Coleta carro, dúvidas e horário e abre o WhatsApp com a mensagem pronta. */
export function ChatVisitPanel({
  initialVehicle,
  onClose,
}: {
  initialVehicle?: string;
  onClose: () => void;
}) {
  const [input, setInput] = useState<ChatVisitInput>({
    vehicle: initialVehicle ?? "",
    questions: "",
    time: "",
  });
  const complete = isChatVisitComplete(input);
  const set = (key: keyof ChatVisitInput) => (value: string) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  return (
    <div
      role="group"
      aria-label="Marcar visita"
      className="shrink-0 space-y-2 border-t border-white/[0.07] bg-[#141417] px-3 pb-2 pt-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-cream">Marcar visita</p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-2 text-[12px] text-cream/70 underline underline-offset-4"
        >
          Fechar
        </button>
      </div>
      <label className="block text-[11px] text-cream/70">
        Carro de interesse
        <input
          className={FIELD}
          value={input.vehicle}
          maxLength={120}
          onChange={(e) => set("vehicle")(e.target.value)}
          placeholder="Ex.: Onix 2020"
        />
      </label>
      <label className="block text-[11px] text-cream/70">
        Dúvidas (opcional)
        <input
          className={FIELD}
          value={input.questions}
          maxLength={300}
          onChange={(e) => set("questions")(e.target.value)}
          placeholder="Ex.: aceita troca? financia?"
        />
      </label>
      <label className="block text-[11px] text-cream/70">
        Horário desejado
        <input
          className={FIELD}
          value={input.time}
          maxLength={80}
          onChange={(e) => set("time")(e.target.value)}
          placeholder="Ex.: sábado de manhã"
        />
      </label>
      <a
        href={complete ? chatVisitWhatsAppUrl(input) : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!complete}
        onClick={(event) => {
          if (!complete) {
            event.preventDefault();
            return;
          }
          trackEvent("chat_visit_request", { has_questions: input.questions.trim() ? 1 : 0 });
          trackWhatsAppClick("chat-visita");
        }}
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-[13px] font-semibold text-asphalt ${
          complete ? "" : "pointer-events-none opacity-50"
        }`}
      >
        <IconWhatsApp className="h-4 w-4" />
        Enviar pelo WhatsApp
      </a>
    </div>
  );
}
