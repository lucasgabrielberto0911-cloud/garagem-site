"use client";

import Link from "next/link";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { VehicleImage } from "@/components/VehicleImage";
import { IconWhatsApp } from "@/components/site/icons";
import { useFormViewport } from "@/lib/form-feedback";
import { formatNumberBR } from "@/lib/format";
import { trackTradeWhatsAppClick } from "@/lib/funnel-events";
import { site } from "@/lib/site";
import {
  TRADE_CONDITION_OPTIONS,
  TRADE_TRANSMISSION_OPTIONS,
  buildTradeWhatsAppUrl,
  validateTradeForm,
  type TradeFormFieldErrorKey,
  type TradeInterestVehicle,
} from "@/lib/trade-whatsapp";

const inputClass =
  "w-full min-h-[48px] border border-white/25 bg-asphalt px-3.5 py-3 text-base text-cream outline-none transition touch-manipulation placeholder:text-cream/60 focus:border-brand focus-visible:ring-2 focus-visible:ring-brand";

const FIELD_IDS: Record<TradeFormFieldErrorKey, string> = {
  brandModel: "trade-brand-model",
  year: "trade-year",
  km: "trade-km",
  transmission: "trade-transmission",
  condition: "trade-condition",
};

export function TradeForm({
  interestVehicle = null,
}: {
  interestVehicle?: TradeInterestVehicle | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  useFormViewport(formRef);

  const [selectedVehicle, setSelectedVehicle] =
    useState<TradeInterestVehicle | null>(interestVehicle);
  const [brandModel, setBrandModel] = useState("");
  const [version, setVersion] = useState("");
  const [year, setYear] = useState("");
  const [km, setKm] = useState("");
  const [transmission, setTransmission] = useState("");
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [interestText, setInterestText] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<TradeFormFieldErrorKey, string>>
  >({});
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [openedUrl, setOpenedUrl] = useState<string | null>(null);

  useEffect(() => {
    setSelectedVehicle(interestVehicle);
  }, [interestVehicle]);

  useEffect(() => {
    if (!focusTarget) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(focusTarget)?.focus();
      setFocusTarget(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusTarget]);

  function clearFieldError(field: TradeFormFieldErrorKey) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateTradeForm({
      brandModel,
      version,
      year,
      km,
      transmission,
      condition,
      notes,
      interestText: selectedVehicle ? "" : interestText,
    });

    if (!result.ok) {
      setErrors(result.errors);
      const firstKey = (Object.keys(FIELD_IDS) as TradeFormFieldErrorKey[]).find(
        (key) => Boolean(result.errors[key]),
      );
      if (firstKey) setFocusTarget(FIELD_IDS[firstKey]);
      return;
    }

    setErrors({});
    const url = buildTradeWhatsAppUrl({
      ...result.data,
      interestVehicle: selectedVehicle,
    });

    trackTradeWhatsAppClick();
    setOpenedUrl(url);

    const popup = window.open(url, "_blank", "noopener,noreferrer");
    if (!popup) {
      window.location.assign(url);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="keyboard-safe-form space-y-4"
      noValidate
    >
      {selectedVehicle ? (
        <section
          aria-label="Carro de interesse na troca"
          className="border border-brand/35 bg-ink p-4 sm:p-5"
          data-trade-interest-card=""
        >
          <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center">
            <div className="relative aspect-[4/3] w-full max-w-[10.5rem] shrink-0 overflow-hidden border border-white/10 bg-ink sm:w-36">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden bg-ink bg-gradient-to-br from-white/[0.08] via-ink to-white/[0.03]"
              >
                <VehicleImage
                  src={selectedVehicle.photoUrl}
                  alt=""
                  fill
                  sizes="168px"
                  className="scale-125 object-cover blur-2xl"
                />
              </div>
              <VehicleImage
                src={selectedVehicle.photoUrl}
                alt={`${selectedVehicle.title} ${selectedVehicle.year}`}
                fill
                sizes="168px"
                className="object-contain"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-light">
                Carro de interesse
              </p>
              <p className="mt-1 font-display text-base font-semibold text-cream sm:text-lg">
                {selectedVehicle.title} · {selectedVehicle.year}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <Link
                  href={selectedVehicle.path}
                  prefetch={false}
                  className="text-brand-light underline decoration-brand/40 underline-offset-4 transition hover:text-cream"
                >
                  Ver anúncio
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedVehicle(null)}
                  className="text-xs text-cream/75 underline decoration-white/30 underline-offset-4 transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Avaliar sem carro específico
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <FormBlock
        title="Seu veículo"
        hint="Preencha os dados básicos para iniciar a avaliação direto no WhatsApp."
      >
        <Field
          label="Marca / modelo"
          htmlFor={FIELD_IDS.brandModel}
          error={errors.brandModel}
        >
          <input
            id={FIELD_IDS.brandModel}
            name="brandModel"
            required
            maxLength={80}
            value={brandModel}
            onChange={(event) => {
              setBrandModel(event.target.value);
              clearFieldError("brandModel");
            }}
            placeholder="Ex.: Honda Civic, VW Polo, Chevrolet Onix"
            className={inputClass}
          />
        </Field>

        <Field label="Versão" htmlFor="trade-version" optional>
          <input
            id="trade-version"
            name="version"
            maxLength={60}
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="Ex.: EXL 2.0, Highline, LTZ"
            className={inputClass}
          />
        </Field>

        <Field label="Ano" htmlFor={FIELD_IDS.year} error={errors.year}>
          <input
            id={FIELD_IDS.year}
            name="year"
            required
            inputMode="numeric"
            maxLength={9}
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              clearFieldError("year");
            }}
            placeholder="Ex.: 2020 ou 2019/2020"
            className={inputClass}
          />
        </Field>

        <Field
          label="Quilometragem (km)"
          htmlFor={FIELD_IDS.km}
          error={errors.km}
        >
          <input
            id={FIELD_IDS.km}
            name="km"
            required
            inputMode="numeric"
            value={km}
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, "").slice(0, 7);
              setKm(digits ? formatNumberBR(Number(digits)) : "");
              clearFieldError("km");
            }}
            placeholder="Ex.: 65.000"
            className={inputClass}
          />
        </Field>

        <Field
          label="Câmbio"
          htmlFor={FIELD_IDS.transmission}
          error={errors.transmission}
        >
          <select
            id={FIELD_IDS.transmission}
            name="transmission"
            required
            value={transmission}
            onChange={(event) => {
              setTransmission(event.target.value);
              clearFieldError("transmission");
            }}
            className={inputClass}
          >
            <option value="">Selecione</option>
            {TRADE_TRANSMISSION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Estado geral"
          htmlFor={FIELD_IDS.condition}
          error={errors.condition}
        >
          <select
            id={FIELD_IDS.condition}
            name="condition"
            required
            value={condition}
            onChange={(event) => {
              setCondition(event.target.value);
              clearFieldError("condition");
            }}
            className={inputClass}
          >
            <option value="">Selecione</option>
            {TRADE_CONDITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {!selectedVehicle ? (
          <div className="lg:col-span-2">
            <Field
              label="Carro de interesse"
              htmlFor="trade-interest-text"
              optional
            >
              <input
                id="trade-interest-text"
                name="interestText"
                maxLength={120}
                value={interestText}
                onChange={(event) => setInterestText(event.target.value)}
                placeholder="Ex.: Corolla, HR-V, SUV automático (ou deixe em branco)"
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-cream/75">
                Já escolheu um veículo? Você também pode{" "}
                <Link
                  href="/estoque"
                  prefetch={false}
                  className="text-brand-light underline decoration-brand/40 underline-offset-4 hover:text-cream"
                >
                  conferir o estoque
                </Link>{" "}
                e clicar em &ldquo;Tem carro pra dar na troca?&rdquo; na ficha.
              </p>
            </Field>
          </div>
        ) : null}

        <div className="lg:col-span-2">
          <Field label="Observações curtas" htmlFor="trade-notes" optional>
            <textarea
              id="trade-notes"
              name="notes"
              rows={3}
              maxLength={280}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex.: único dono, revisões em dia, pneus novos..."
              className={`${inputClass} resize-y`}
              aria-describedby="trade-notes-hint"
            />
            <p id="trade-notes-hint" className="mt-1.5 text-xs text-cream/75">
              Não informe placa, CPF, telefone nem dados pessoais neste campo — combinamos os detalhes direto na conversa.
            </p>
          </Field>
        </div>
      </FormBlock>

      <div className="border border-white/20 bg-ink p-4 sm:p-5">
        <button
          type="submit"
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 bg-brand px-7 py-4 font-display text-sm font-semibold uppercase tracking-wide text-cream shadow-lg transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt active:bg-brand-dark sm:text-base touch-manipulation"
        >
          <IconWhatsApp className="h-5 w-5 shrink-0" />
          Enviar pelo WhatsApp
        </button>

        {openedUrl ? (
          <p
            role="status"
            className="mt-3 text-sm leading-relaxed text-cream/85"
          >
            Abrimos o WhatsApp com os dados organizados. Se não abriu
            automaticamente,{" "}
            <a
              href={openedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-light underline underline-offset-4 hover:text-cream"
            >
              toque aqui para abrir a conversa
            </a>
            .
          </p>
        ) : null}

        <p className="mt-3 text-xs leading-relaxed text-cream/75">
          Nenhum dado fica gravado no site. O botão apenas abre o WhatsApp da{" "}
          {site.name} ({site.whatsappLabel}) com o resumo pronto para você enviar.
        </p>
      </div>
    </form>
  );
}

function FormBlock({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-white/20 bg-ink p-4 sm:p-5">
      <h3 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-brand-light">
        {title}
      </h3>
      {hint ? (
        <p className="mt-1 text-sm leading-snug text-cream/75">{hint}</p>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:gap-x-5">
        {children}
      </div>
    </section>
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
  children: ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  const decorated = Children.map(children, (child, index) => {
    if (index === 0 && isValidElement(child)) {
      const describedBy = [
        (child.props as { "aria-describedby"?: string })["aria-describedby"],
        error ? errorId : null,
      ]
        .filter(Boolean)
        .join(" ");
      return cloneElement(
        child as React.ReactElement<Record<string, unknown>>,
        {
          "aria-invalid": Boolean(error) || undefined,
          "aria-describedby": describedBy || undefined,
        },
      );
    }
    return child;
  });
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-cream/85"
      >
        {label}
        {optional ? (
          <span className="ml-1 font-normal normal-case text-cream/75">
            (opcional)
          </span>
        ) : (
          <span className="ml-1 text-brand-light" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {decorated}
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-brand-light" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
