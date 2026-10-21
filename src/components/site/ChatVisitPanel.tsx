"use client";

import { useState } from "react";
import { IconWhatsApp } from "@/components/site/icons";
import {
  VISIT_TIME_OPTIONS,
  chatVisitWhatsAppUrl,
  isChatVisitComplete,
  type ChatVisitInput,
} from "@/lib/chat-visit";
import { trackWhatsAppClick, type VehicleFunnelRef } from "@/lib/meta-pixel";
import { queueWhatsAppIfOffline } from "@/lib/offline-whatsapp";
import { trackEvent } from "@/lib/track-event";

const FIELD =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] text-cream placeholder:text-cream/40 focus:border-white/25 focus:outline-none";

/** Coleta carro, dúvidas e horário e abre o WhatsApp com a mensagem pronta. */
export function ChatVisitPanel({
  initialVehicle,
  funnel,
  onClose,
}: {
  initialVehicle?: string;
  funnel?: VehicleFunnelRef;
  onClose: () => void;
}) {
  const [input, setInput] = useState<ChatVisitInput>({
    vehicle: initialVehicle ?? "",
    questions: "",
    time: "",
  });
  const complete = isChatVisitComplete(input);
  const href = complete ? chatVisitWhatsAppUrl(input) : undefined;
  const set = (key: keyof ChatVisitInput) => (value: string) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  return (
    <div
      id="chat-visit-panel"
      role="group"
      aria-label="Marcar visita"
      className="max-h-[55%] shrink-0 overflow-y-auto space-y-2 border-t border-white/[0.07] bg-asphalt px-3 pb-2 pt-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-cream">Marcar visita</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="relative h-8 w-8 text-xl text-cream/70 before:absolute before:-inset-1.5 before:content-['']"
        >
          ×
        </button>
      </div>
      <label className="block text-[11px] text-cream/70">
        Carro de interesse <span className="text-brand-light" aria-hidden="true">*</span>
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
        Horário desejado <span className="text-brand-light" aria-hidden="true">*</span>
        <input
          className={FIELD}
          value={input.time}
          maxLength={80}
          onChange={(e) => set("time")(e.target.value)}
          placeholder="Ex.: sábado de manhã"
        />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {VISIT_TIME_OPTIONS.map((option) => {
          const selected = input.time === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => set("time")(option)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition touch-manipulation ${
                selected
                  ? "border-brand/70 bg-brand/20 text-cream"
                  : "border-white/10 bg-white/[0.04] text-cream/75 hover:border-white/25 hover:text-cream"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {!complete ? (
        <p className="text-[11px] text-cream/50">
          Preencha o carro e o horário desejado para enviar.
        </p>
      ) : null}
      <a
        role="link"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!complete}
        onClick={(event) => {
          if (!complete || !href) {
            event.preventDefault();
            return;
          }
          trackEvent("chat_visit_request", { has_questions: input.questions.trim() ? 1 : 0 });
          trackWhatsAppClick("chat-visita", funnel);
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            event.preventDefault();
            void queueWhatsAppIfOffline({
              url: event.currentTarget.href || href,
              label: "chat-visita",
              vehicleId: funnel?.vehicleId,
            });
          }
          onClose();
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
