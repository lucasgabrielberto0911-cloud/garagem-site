"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createWantedLead } from "@/app/(site)/estoque/wanted-actions";
import { formatNumberBR, formatPhoneBR } from "@/lib/format";
import { trackLead } from "@/lib/meta-pixel";
import {
  parseWantedLeadForm,
  WANTED_LEAD_SUCCESS,
  type WantedLeadPage,
} from "@/lib/wanted-lead";

const inputClass =
  "w-full min-h-[48px] border border-white/10 bg-asphalt px-3.5 py-3 text-base text-cream outline-none transition placeholder:text-muted focus:border-brand";

function digitsToGrouped(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const amount = Number(digits);
  return Number.isFinite(amount) ? formatNumberBR(amount) : "";
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-xs text-brand" role="alert">
      {message}
    </p>
  );
}

export function MissingModelForm({
  idPrefix,
  sourcePage,
  title = "Não encontrou o modelo?",
  titleAs = "h2",
  description = "Deixa o modelo que você procura. A loja guarda o pedido e te chama quando aparecer.",
  contextLabel = "",
  pagePath = "",
  interestVehicleId = "",
  initialModel = "",
  initialYearMin = "",
  initialYearMax = "",
  initialPriceMin = "",
  initialPriceMax = "",
  initialKmMin = "",
  initialKmMax = "",
}: {
  idPrefix: string;
  sourcePage: WantedLeadPage;
  title?: string;
  titleAs?: "h1" | "h2";
  description?: string;
  contextLabel?: string;
  pagePath?: string;
  interestVehicleId?: string;
  initialModel?: string;
  initialYearMin?: string;
  initialYearMax?: string;
  initialPriceMin?: string;
  initialPriceMax?: string;
  initialKmMin?: string;
  initialKmMax?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [phone, setPhone] = useState("");
  const [priceMin, setPriceMin] = useState(() => digitsToGrouped(initialPriceMin));
  const [priceMax, setPriceMax] = useState(() => digitsToGrouped(initialPriceMax));
  const [kmMin, setKmMin] = useState(() => digitsToGrouped(initialKmMin));
  const [kmMax, setKmMax] = useState(() => digitsToGrouped(initialKmMax));
  const TitleTag = titleAs;

  const ids = {
    model: `${idPrefix}-modelo`,
    name: `${idPrefix}-nome`,
    email: `${idPrefix}-email`,
    phone: `${idPrefix}-telefone`,
    yearMin: `${idPrefix}-ano-de`,
    yearMax: `${idPrefix}-ano-ate`,
    priceMin: `${idPrefix}-preco-de`,
    priceMax: `${idPrefix}-preco-ate`,
    kmMin: `${idPrefix}-km-de`,
    kmMax: `${idPrefix}-km-ate`,
    consent: `${idPrefix}-consentimento`,
  };

  function focusField(name: string) {
    const id = ids[name as keyof typeof ids];
    if (!id) return;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = parseWantedLeadForm(data);
    if (!parsed.ok) {
      setErrors(parsed.fieldErrors);
      setFormError(parsed.message);
      focusField(Object.keys(parsed.fieldErrors)[0] ?? "");
      return;
    }
    if (parsed.ignored) {
      setErrors({});
      setFormError("");
      setSent(true);
      return;
    }

    setErrors({});
    setFormError("");
    startTransition(async () => {
      try {
        const result = await createWantedLead(data);
        if (result.ok) {
          trackLead({
            content_ids: [],
            content_name: "Não encontrou o modelo",
            search_string: parsed.lead?.model,
          });
          toast.success(result.message);
          setSent(true);
          return;
        }
        const fieldErrors = result.fieldErrors ?? {};
        setErrors(fieldErrors);
        setFormError(result.message);
        toast.error(result.message);
        focusField(Object.keys(fieldErrors)[0] ?? "");
      } catch {
        const message = "Não foi possível enviar agora. Tente de novo.";
        setFormError(message);
        toast.error(message);
      }
    });
  }

  if (sent) {
    return (
      <section
        data-missing-model-form=""
        className="border border-brand/40 bg-ink p-6 text-center sm:p-8"
        aria-live="polite"
      >
        <TitleTag className="font-display text-xl font-bold text-cream">
          Pedido recebido
        </TitleTag>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          {WANTED_LEAD_SUCCESS}
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-6 min-h-[48px] border border-white/20 px-5 py-3 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-white/5"
        >
          Enviar outro pedido
        </button>
      </section>
    );
  }

  return (
    <section
      data-missing-model-form=""
      className="border border-white/10 bg-ink p-5 sm:p-7"
    >
      <TitleTag className="font-display text-xl font-bold tracking-tight text-cream sm:text-2xl">
        {title}
      </TitleTag>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
        {description}
      </p>

      <form className="relative mt-5" noValidate onSubmit={handleSubmit}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
        >
          <label htmlFor={`${idPrefix}-website`}>Website</label>
          <input
            id={`${idPrefix}-website`}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <input type="hidden" name="sourcePage" value={sourcePage} />
        <input type="hidden" name="contextLabel" value={contextLabel} />
        <input type="hidden" name="pagePath" value={pagePath} />
        {interestVehicleId ? (
          <input type="hidden" name="interestVehicleId" value={interestVehicleId} />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label
              htmlFor={ids.model}
              className="mb-1.5 block text-xs uppercase tracking-wider text-muted"
            >
              Modelo que você procura
              <span className="ml-1 text-brand" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id={ids.model}
              name="model"
              required
              defaultValue={initialModel}
              autoComplete="off"
              placeholder="Ex.: Corolla automático"
              aria-invalid={Boolean(errors.model) || undefined}
              aria-describedby={errors.model ? `${ids.model}-erro` : undefined}
              className={inputClass}
            />
            <FieldError id={`${ids.model}-erro`} message={errors.model} />
          </div>

          <div>
            <label
              htmlFor={ids.name}
              className="mb-1.5 block text-xs uppercase tracking-wider text-muted"
            >
              Seu nome
              <span className="ml-1 text-brand" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id={ids.name}
              name="name"
              required
              autoComplete="name"
              placeholder="Nome completo"
              aria-invalid={Boolean(errors.name) || undefined}
              aria-describedby={errors.name ? `${ids.name}-erro` : undefined}
              className={inputClass}
            />
            <FieldError id={`${ids.name}-erro`} message={errors.name} />
          </div>

          <div>
            <label
              htmlFor={ids.email}
              className="mb-1.5 block text-xs uppercase tracking-wider text-muted"
            >
              E-mail
              <span className="ml-1 text-brand" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id={ids.email}
              name="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="voce@email.com"
              aria-invalid={Boolean(errors.email) || undefined}
              aria-describedby={errors.email ? `${ids.email}-erro` : undefined}
              className={inputClass}
            />
            <FieldError id={`${ids.email}-erro`} message={errors.email} />
          </div>

          <div className="sm:col-span-2">
            <label
              htmlFor={ids.phone}
              className="mb-1.5 block text-xs uppercase tracking-wider text-muted"
            >
              Telefone
              <span className="ml-1 text-brand" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id={ids.phone}
              name="phone"
              required
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(formatPhoneBR(event.target.value))}
              placeholder="(00) 00000-0000"
              aria-invalid={Boolean(errors.phone) || undefined}
              aria-describedby={errors.phone ? `${ids.phone}-erro` : undefined}
              className={inputClass}
            />
            <FieldError id={`${ids.phone}-erro`} message={errors.phone} />
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="text-xs uppercase tracking-wider text-muted">
            Faixas (opcional)
          </legend>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-1.5 text-xs text-muted">Ano</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  id={ids.yearMin}
                  name="yearMin"
                  inputMode="numeric"
                  maxLength={4}
                  defaultValue={initialYearMin.replace(/\D/g, "").slice(0, 4)}
                  placeholder="De"
                  aria-label="Ano inicial"
                  aria-invalid={Boolean(errors.yearMin) || undefined}
                  className={inputClass}
                />
                <input
                  id={ids.yearMax}
                  name="yearMax"
                  inputMode="numeric"
                  maxLength={4}
                  defaultValue={initialYearMax.replace(/\D/g, "").slice(0, 4)}
                  placeholder="Até"
                  aria-label="Ano final"
                  aria-invalid={Boolean(errors.yearMax) || undefined}
                  className={inputClass}
                />
              </div>
              <FieldError id={`${ids.yearMin}-erro`} message={errors.yearMin} />
              <FieldError id={`${ids.yearMax}-erro`} message={errors.yearMax} />
            </div>

            <div>
              <p className="mb-1.5 text-xs text-muted">Preço</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  id={ids.priceMin}
                  name="priceMin"
                  inputMode="numeric"
                  value={priceMin}
                  onChange={(event) => setPriceMin(digitsToGrouped(event.target.value))}
                  placeholder="De"
                  aria-label="Preço inicial"
                  aria-invalid={Boolean(errors.priceMin) || undefined}
                  className={inputClass}
                />
                <input
                  id={ids.priceMax}
                  name="priceMax"
                  inputMode="numeric"
                  value={priceMax}
                  onChange={(event) => setPriceMax(digitsToGrouped(event.target.value))}
                  placeholder="Até"
                  aria-label="Preço final"
                  aria-invalid={Boolean(errors.priceMax) || undefined}
                  className={inputClass}
                />
              </div>
              <FieldError id={`${ids.priceMin}-erro`} message={errors.priceMin} />
              <FieldError id={`${ids.priceMax}-erro`} message={errors.priceMax} />
            </div>

            <div>
              <p className="mb-1.5 text-xs text-muted">Quilometragem</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  id={ids.kmMin}
                  name="kmMin"
                  inputMode="numeric"
                  value={kmMin}
                  onChange={(event) => setKmMin(digitsToGrouped(event.target.value))}
                  placeholder="De"
                  aria-label="Quilometragem inicial"
                  aria-invalid={Boolean(errors.kmMin) || undefined}
                  className={inputClass}
                />
                <input
                  id={ids.kmMax}
                  name="kmMax"
                  inputMode="numeric"
                  value={kmMax}
                  onChange={(event) => setKmMax(digitsToGrouped(event.target.value))}
                  placeholder="Até"
                  aria-label="Quilometragem final"
                  aria-invalid={Boolean(errors.kmMax) || undefined}
                  className={inputClass}
                />
              </div>
              <FieldError id={`${ids.kmMin}-erro`} message={errors.kmMin} />
              <FieldError id={`${ids.kmMax}-erro`} message={errors.kmMax} />
            </div>
          </div>
        </fieldset>

        <div className="mt-5 flex items-start gap-3">
          <input
            id={ids.consent}
            name="consent"
            type="checkbox"
            value="sim"
            aria-invalid={Boolean(errors.consent) || undefined}
            aria-describedby={errors.consent ? `${ids.consent}-erro` : undefined}
            className="mt-1 h-4 w-4 shrink-0 accent-brand"
          />
          <div>
            <label
              htmlFor={ids.consent}
              className="text-xs leading-relaxed text-muted"
            >
              Autorizo a Sua Garagem a usar meu nome, e-mail e telefone só para
              me avisar sobre o modelo que pedi. Sem spam e sem repassar a
              terceiros.
            </label>{" "}
            <Link
              href="/privacidade"
              className="text-xs text-cream underline decoration-white/30 underline-offset-2 hover:text-brand"
            >
              Política de privacidade
            </Link>
            <FieldError id={`${ids.consent}-erro`} message={errors.consent} />
          </div>
        </div>

        {formError ? (
          <p className="mt-4 text-sm text-brand" role="alert">
            {formError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center bg-brand px-7 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:opacity-70 sm:w-auto"
        >
          {isPending ? "Enviando…" : "Enviar pedido"}
        </button>
      </form>
    </section>
  );
}
