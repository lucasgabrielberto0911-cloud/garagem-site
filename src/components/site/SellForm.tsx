"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { WhatsAppButton } from "@/components/site/ui";
import { createSellLead } from "@/app/(site)/vender/actions";
import { formatNumberBR, formatPhoneBR } from "@/lib/format";
import { WHATSAPP_MESSAGES } from "@/lib/site";

const inputClass =
  "w-full min-h-[48px] border border-white/10 bg-asphalt px-3 py-3 text-base text-cream outline-none transition placeholder:text-muted focus:border-brand sm:py-2.5 sm:text-sm";

export function SellForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [phone, setPhone] = useState("");
  const [km, setKm] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await createSellLead(data);
      setErrors(result.fieldErrors ?? {});

      if (result.ok) {
        toast.success(result.message);
        setSent(true);
        setPhone("");
        setKm("");
        formRef.current?.reset();
      } else {
        toast.error(result.message);
      }
    });
  }

  if (sent) {
    return (
      <div className="border border-brand/40 bg-ink p-8 text-center">
        <div className="mx-auto h-0.5 w-16 bg-brand-gradient" aria-hidden="true" />
        <h2 className="mt-6 font-display text-xl font-bold text-cream">
          Solicitação enviada!
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Recebemos os dados do seu veículo. Nossa equipe vai analisar e entrar em
          contato pelo telefone informado. Se preferir agilizar, chame no
          WhatsApp.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <WhatsAppButton message={WHATSAPP_MESSAGES.sell}>
            Chamar no WhatsApp
          </WhatsAppButton>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="border border-white/20 px-5 py-3 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-white/5"
          >
            Enviar outro veículo
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="relative border border-white/10 bg-ink p-6 sm:p-8"
    >
      {/* Honeypot anti-spam — oculto de leitores de tela e usuários. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Seu nome" error={errors.name} htmlFor="name">
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            placeholder="Nome completo"
            className={inputClass}
          />
        </Field>

        <Field label="Telefone / WhatsApp" error={errors.phone} htmlFor="phone">
          <input
            id="phone"
            name="phone"
            required
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(formatPhoneBR(event.target.value))}
            placeholder="(00) 00000-0000"
            className={inputClass}
          />
        </Field>

        <Field label="Marca do veículo" error={errors.brand} htmlFor="brand">
          <input
            id="brand"
            name="brand"
            required
            placeholder="Ex.: Volkswagen"
            className={inputClass}
          />
        </Field>

        <Field label="Modelo" error={errors.model} htmlFor="model">
          <input
            id="model"
            name="model"
            required
            placeholder="Ex.: Golf GTI"
            className={inputClass}
          />
        </Field>

        <Field label="Ano" error={errors.year} htmlFor="year">
          <input
            id="year"
            name="year"
            required
            inputMode="numeric"
            maxLength={4}
            placeholder="Ex.: 2021"
            className={inputClass}
          />
        </Field>

        <Field label="Quilometragem" error={errors.km} htmlFor="km" optional>
          <input
            id="km"
            name="km"
            inputMode="numeric"
            value={km}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "");
              setKm(digits ? formatNumberBR(Number(digits)) : "");
            }}
            placeholder="Ex.: 45.000"
            className={inputClass}
          />
        </Field>

        <div className="sm:col-span-2">
          <Field label="Observações" error={errors.notes} htmlFor="notes" optional>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Conte o estado do veículo, itens opcionais, se há débitos, se quer vender ou trocar..."
              className={`${inputClass} resize-y`}
            />
          </Field>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-[52px] bg-brand px-7 py-4 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:opacity-70"
        >
          {isPending ? "Enviando..." : "Solicitar avaliação"}
        </button>
        <WhatsAppButton size="lg" variant="outline" message={WHATSAPP_MESSAGES.sell}>
          Prefiro chamar no WhatsApp
        </WhatsAppButton>
      </div>

      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        Seus dados são usados apenas para o contato da avaliação. Não enviamos
        spam nem compartilhamos com terceiros.
      </p>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  optional = false,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs uppercase tracking-wider text-muted"
      >
        {label}
        {optional ? <span className="ml-1 normal-case">(opcional)</span> : null}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-brand">{error}</p> : null}
    </div>
  );
}
