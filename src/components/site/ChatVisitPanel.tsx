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
  "w-full mt-1 min-h-11 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-base text-cream lg:text-[14px] placeholder:text-cream/40 focus:border-white/25 focus:outline-none";

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
      id="chat-visit-panel"
      role="group"
      aria-label="Marcar visita"
      className="max-h-[55%] shrink-0 overflow-y-auto space-y-3 border-t border-white/[0.07] bg-asphalt px-4 pb-3 pt-3"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-[15px] font-semibold leading-5 text-cream">Marcar visita</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="relative -mr-2 h-10 w-10 text-xl text-cream/70 before:absolute before:-inset-1.5 before:content-['']"
        >
          ×
        </button>
      </div>
      <label className="block text-[12px] font-medium leading-4 text-cream/75">
        Carro de interesse
        <input
          className={FIELD}
          value={input.vehicle}
          maxLength={120}
          onChange={(e) => set("vehicle")(e.target.value)}
          placeholder="Ex.: Onix 2020"
        />
      </label>
      <label className="block text-[12px] font-medium leading-4 text-cream/75">
        Dúvidas (opcional)
        <input
          className={FIELD}
          value={input.questions}
          maxLength={300}
          onChange={(e) => set("questions")(e.target.value)}
          placeholder="Ex.: aceita troca? financia?"
        />
      </label>
      <label className="block text-[12px] font-medium leading-4 text-cream/75">
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
        role="link"
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
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-[14px] font-semibold text-asphalt ${
          complete ? "" : "pointer-events-none opacity-50"
        }`}
      >
        <IconWhatsApp className="h-4 w-4" />
        Enviar pelo WhatsApp
      </a>
    </div>
  );
}
