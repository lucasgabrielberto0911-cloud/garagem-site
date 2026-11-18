"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { VehicleImage } from "@/components/VehicleImage";
import { IconArrowRight, IconWhatsApp } from "@/components/site/icons";
import { useFormViewport } from "@/lib/form-feedback";
import { formatNumberBR } from "@/lib/format";
import { trackTradeWhatsAppClick } from "@/lib/funnel-events";
import { site } from "@/lib/site";
import {
  TRADE_CONDITION_OPTIONS,
  TRADE_FIELD_ERRORS,
  TRADE_STEP_COUNT,
  TRADE_TRANSMISSION_CHOICES,
  buildTradeWhatsAppUrl,
  formatTradeKm,
  normalizeTradeCondition,
  normalizeTradeYear,
  stepForTradeFieldError,
  validateTradeForm,
  validateTradeStep,
  type TradeFormFieldErrorKey,
  type TradeInterestVehicle,
  type TradeStep,
} from "@/lib/trade-whatsapp";

const inputBaseClass =
  "w-full min-h-[54px] border bg-asphalt px-4 py-3.5 text-lg text-cream outline-none transition touch-manipulation placeholder:text-cream/55 focus:border-brand focus-visible:ring-2 focus-visible:ring-brand";

function fieldInputClass(hasError: boolean): string {
  return `${inputBaseClass} ${
    hasError ? "border-brand-light ring-1 ring-brand-light" : "border-white/30"
  }`;
}

const FIELD_IDS: Record<TradeFormFieldErrorKey, string> = {
  brandModel: "trade-brand-model",
  year: "trade-year",
  km: "trade-km",
  transmission: "trade-transmission",
  condition: "trade-condition",
};

const STEP_LABELS: Record<TradeStep, string> = {
  1: "Seu carro",
  2: "Ano e km",
  3: "Câmbio",
  4: "Como está hoje",
  5: "Mandar no WhatsApp",
};

export function TradeForm({
  interestVehicle = null,
  initialStep = 1,
}: {
  interestVehicle?: TradeInterestVehicle | null;
  initialStep?: TradeStep;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const didMountRef = useRef(false);
  useFormViewport(formRef);

  const [step, setStep] = useState<TradeStep>(initialStep);
  const [selectedVehicle, setSelectedVehicle] =
    useState<TradeInterestVehicle | null>(interestVehicle);
  const [brandModel, setBrandModel] = useState("");
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
  }, [focusTarget, step]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (focusTarget) return;
    const frame = window.requestAnimationFrame(() => {
      const heading = stepHeadingRef.current;
      if (!heading) return;
      heading.focus({ preventScroll: true });
      const rect = heading.getBoundingClientRect();
      if (rect.top < 80 || rect.top > window.innerHeight * 0.7) {
        heading.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [step, focusTarget]);

  function clearFieldError(field: TradeFormFieldErrorKey) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function currentRawValues() {
    return {
      brandModel,
      year,
      km,
      transmission,
      condition,
      notes,
      interestText: selectedVehicle ? "" : interestText,
    };
  }

  function focusFirstError(
    nextErrors: Partial<Record<TradeFormFieldErrorKey, string>>,
  ) {
    const firstKey = (Object.keys(FIELD_IDS) as TradeFormFieldErrorKey[]).find(
      (key) => Boolean(nextErrors[key]),
    );
    if (firstKey) {
      setFocusTarget(FIELD_IDS[firstKey]);
    }
  }

  function goToStep(target: TradeStep) {
    setErrors({});
    setStep(target);
  }

  function handleBack() {
    if (step > 1) {
      goToStep((step - 1) as TradeStep);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = currentRawValues();

    if (step < TRADE_STEP_COUNT) {
      const stepCheck = validateTradeStep(step, raw);
      if (!stepCheck.ok) {
        setErrors(stepCheck.errors);
        focusFirstError(stepCheck.errors);
        return;
      }
      setErrors({});
      setStep((step + 1) as TradeStep);
      return;
    }

    const result = validateTradeForm(raw);
    if (!result.ok) {
      setErrors(result.errors);
      const firstKey = (Object.keys(FIELD_IDS) as TradeFormFieldErrorKey[]).find(
        (key) => Boolean(result.errors[key]),
      );
      if (firstKey) {
        setStep(stepForTradeFieldError(firstKey));
        setFocusTarget(FIELD_IDS[firstKey]);
      }
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

  const conditionLabel =
    normalizeTradeCondition(condition) ?? condition ?? "Não informado";
  const formattedKmSummary = formatTradeKm(km) ?? (km ? `${km} km` : "Não informado");

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="keyboard-safe-form space-y-5"
      noValidate
    >
      {selectedVehicle ? (
        <section
          aria-label="Carro de interesse na troca"
          className="border border-brand/40 bg-ink p-4 sm:p-5"
          data-trade-interest-card=""
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative aspect-[4/3] w-full max-w-[11.5rem] shrink-0 overflow-hidden border border-white/15 bg-ink sm:w-40">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 overflow-hidden bg-ink bg-gradient-to-br from-white/[0.08] via-ink to-white/[0.03]"
              >
                <VehicleImage
                  src={selectedVehicle.photoUrl}
                  alt=""
                  fill
                  sizes="176px"
                  className="scale-125 object-cover blur-2xl"
                />
              </div>
              <VehicleImage
                src={selectedVehicle.photoUrl}
                alt={`${selectedVehicle.title} ${selectedVehicle.year}`}
                fill
                sizes="176px"
                className="object-contain"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold text-brand-light">
                Carro que você gostou
              </p>
              <p className="mt-1 font-display text-lg font-bold text-cream sm:text-xl">
                {selectedVehicle.title} · {selectedVehicle.year}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Link
                  href={selectedVehicle.path}
                  prefetch={false}
                  className="inline-flex min-h-[44px] items-center px-1 text-base font-medium text-brand-light underline decoration-brand/50 underline-offset-4 transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Ver anúncio
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedVehicle(null)}
                  className="inline-flex min-h-[44px] items-center px-2 text-base text-cream/85 underline decoration-white/35 underline-offset-4 transition hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  Trocar sem escolher carro
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="border border-white/20 bg-ink p-5 sm:p-7">
        <div className="mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-display text-base font-semibold text-brand-light">
              Passo {step} de {TRADE_STEP_COUNT}
            </p>
            <p className="text-base text-cream/80">{STEP_LABELS[step]}</p>
          </div>
          <div
            className="mt-3 grid grid-cols-5 gap-1.5"
            role="progressbar"
            aria-label="Progresso das perguntas"
            aria-valuemin={1}
            aria-valuemax={TRADE_STEP_COUNT}
            aria-valuenow={step}
          >
            {([1, 2, 3, 4, 5] as const).map((item) => (
              <span
                key={item}
                className={`h-2 transition-colors ${
                  item <= step ? "bg-brand" : "bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <h3
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-display text-xl font-bold leading-snug text-cream outline-none sm:text-2xl"
            >
              <label htmlFor={FIELD_IDS.brandModel} className="cursor-pointer">
                Qual é o seu carro?
              </label>
            </h3>
            <p
              id="trade-brand-model-hint"
              className="text-base leading-relaxed text-cream/85"
            >
              Escreva a marca e o modelo do jeito que você conhece. Se souber a
              versão ou o motor, pode escrever junto.
            </p>
            <div>
              <input
                id={FIELD_IDS.brandModel}
                name="brandModel"
                type="text"
                required
                maxLength={80}
                autoComplete="off"
                value={brandModel}
                onChange={(event) => {
                  setBrandModel(event.target.value);
                  clearFieldError("brandModel");
                }}
                onBlur={() => {
                  const trimmed = brandModel.trim();
                  if (trimmed.length > 0 && trimmed.length < 2) {
                    setErrors((prev) => ({
                      ...prev,
                      brandModel: TRADE_FIELD_ERRORS.brandModel,
                    }));
                  }
                }}
                placeholder="Ex.: Gol 1.0, Onix, Corolla, HB20"
                aria-invalid={Boolean(errors.brandModel) || undefined}
                aria-describedby={
                  errors.brandModel
                    ? "trade-brand-model-hint trade-brand-model-error"
                    : "trade-brand-model-hint"
                }
                className={fieldInputClass(Boolean(errors.brandModel))}
              />
              <FieldError
                id="trade-brand-model-error"
                message={errors.brandModel}
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <div>
              <h3
                ref={stepHeadingRef}
                tabIndex={-1}
                className="font-display text-xl font-bold leading-snug text-cream outline-none sm:text-2xl"
              >
                Qual é o ano e quantos km ele tem?
              </h3>
              <p className="mt-1.5 text-base leading-relaxed text-cream/85">
                Não precisa ser o número exato do painel — um valor aproximado
                já resolve.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={FIELD_IDS.year}
                  className="block font-display text-lg font-semibold text-cream"
                >
                  De que ano é o carro?
                </label>
                <p id="trade-year-hint" className="mt-1 text-base text-cream/80">
                  Ex.: 2020 ou 2019/2020
                </p>
                <input
                  id={FIELD_IDS.year}
                  name="year"
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={9}
                  autoComplete="off"
                  value={year}
                  onChange={(event) => {
                    setYear(event.target.value);
                    clearFieldError("year");
                  }}
                  onBlur={() => {
                    if (year.trim() && !normalizeTradeYear(year)) {
                      setErrors((prev) => ({
                        ...prev,
                        year: TRADE_FIELD_ERRORS.year,
                      }));
                    }
                  }}
                  placeholder="Ex.: 2020"
                  aria-invalid={Boolean(errors.year) || undefined}
                  aria-describedby={
                    errors.year
                      ? "trade-year-hint trade-year-error"
                      : "trade-year-hint"
                  }
                  className={`mt-2 ${fieldInputClass(Boolean(errors.year))}`}
                />
                <FieldError id="trade-year-error" message={errors.year} />
              </div>

              <div>
                <label
                  htmlFor={FIELD_IDS.km}
                  className="block font-display text-lg font-semibold text-cream"
                >
                  Quantos km ele já rodou?
                </label>
                <p id="trade-km-hint" className="mt-1 text-base text-cream/80">
                  Ex.: 65.000 (aproximado)
                </p>
                <input
                  id={FIELD_IDS.km}
                  name="km"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  value={km}
                  onChange={(event) => {
                    const digits = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 7);
                    setKm(digits ? formatNumberBR(Number(digits)) : "");
                    clearFieldError("km");
                  }}
                  onBlur={() => {
                    if (km.trim() && !formatTradeKm(km)) {
                      setErrors((prev) => ({
                        ...prev,
                        km: TRADE_FIELD_ERRORS.km,
                      }));
                    }
                  }}
                  placeholder="Ex.: 65.000"
                  aria-invalid={Boolean(errors.km) || undefined}
                  aria-describedby={
                    errors.km ? "trade-km-hint trade-km-error" : "trade-km-hint"
                  }
                  className={`mt-2 ${fieldInputClass(Boolean(errors.km))}`}
                />
                <FieldError id="trade-km-error" message={errors.km} />
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <fieldset
            aria-describedby={
              errors.transmission ? "trade-transmission-error" : undefined
            }
            className="space-y-4"
          >
            <legend className="contents">
              <h3
                ref={stepHeadingRef}
                tabIndex={-1}
                className="font-display text-xl font-bold leading-snug text-cream outline-none sm:text-2xl"
              >
                Como é o câmbio do seu carro?
              </h3>
            </legend>
            <p className="text-base leading-relaxed text-cream/85">
              Toque em uma das duas opções abaixo.
            </p>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {TRADE_TRANSMISSION_CHOICES.map((option, index) => {
                const selected = transmission === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex min-h-[76px] cursor-pointer items-center gap-4 border p-4 transition touch-manipulation focus-within:ring-2 focus-within:ring-brand-light sm:p-5 ${
                      selected
                        ? "border-brand bg-brand/15 text-cream"
                        : "border-white/30 bg-asphalt text-cream hover:border-white/55"
                    }`}
                  >
                    <input
                      id={index === 0 ? FIELD_IDS.transmission : undefined}
                      type="radio"
                      name="transmission"
                      value={option.value}
                      checked={selected}
                      onChange={() => {
                        setTransmission(option.value);
                        clearFieldError("transmission");
                      }}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        selected
                          ? "border-brand bg-brand"
                          : "border-white/50 bg-asphalt"
                      }`}
                    >
                      {selected ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-cream" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg font-bold text-cream">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-base leading-snug text-cream/80">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <FieldError
              id="trade-transmission-error"
              message={errors.transmission}
            />
          </fieldset>
        ) : null}

        {step === 4 ? (
          <fieldset
            aria-describedby={
              errors.condition ? "trade-condition-error" : undefined
            }
            className="space-y-4"
          >
            <legend className="contents">
              <h3
                ref={stepHeadingRef}
                tabIndex={-1}
                className="font-display text-xl font-bold leading-snug text-cream outline-none sm:text-2xl"
              >
                Como está o seu carro hoje?
              </h3>
            </legend>
            <p className="text-base leading-relaxed text-cream/85">
              Escolha a opção mais parecida com a realidade — avaliamos de tudo
              com transparência.
            </p>

            <div className="grid gap-3.5">
              {TRADE_CONDITION_OPTIONS.map((option, index) => {
                const selected = condition === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex min-h-[78px] cursor-pointer items-center gap-4 border p-4 transition touch-manipulation focus-within:ring-2 focus-within:ring-brand-light sm:p-5 ${
                      selected
                        ? "border-brand bg-brand/15 text-cream"
                        : "border-white/30 bg-asphalt text-cream hover:border-white/55"
                    }`}
                  >
                    <input
                      id={index === 0 ? FIELD_IDS.condition : undefined}
                      type="radio"
                      name="condition"
                      value={option.value}
                      checked={selected}
                      onChange={() => {
                        setCondition(option.value);
                        clearFieldError("condition");
                      }}
                      className="sr-only"
                    />
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        selected
                          ? "border-brand bg-brand"
                          : "border-white/50 bg-asphalt"
                      }`}
                    >
                      {selected ? (
                        <span className="h-2.5 w-2.5 rounded-full bg-cream" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg font-bold text-cream">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-base leading-snug text-cream/80">
                        {option.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <FieldError id="trade-condition-error" message={errors.condition} />
          </fieldset>
        ) : null}

        {step === 5 ? (
          <div className="space-y-6">
            <div>
              <h3
                ref={stepHeadingRef}
                tabIndex={-1}
                className="font-display text-xl font-bold leading-snug text-cream outline-none sm:text-2xl"
              >
                Confira e mande pelo WhatsApp
              </h3>
              <p className="mt-1.5 text-base leading-relaxed text-cream/85">
                Veja se os dados do seu carro estão certinhos. Se quiser
                corrigir algo, toque em &ldquo;Mudar&rdquo;.
              </p>
            </div>

            <dl className="divide-y divide-white/15 border border-white/20 bg-asphalt">
              <SummaryRow
                label="Seu carro"
                value={brandModel || "Não informado"}
                onEdit={() => goToStep(1)}
              />
              <SummaryRow
                label="Ano e km"
                value={`${year || "—"} · ${formattedKmSummary}`}
                onEdit={() => goToStep(2)}
              />
              <SummaryRow
                label="Câmbio"
                value={transmission || "Não informado"}
                onEdit={() => goToStep(3)}
              />
              <SummaryRow
                label="Como está hoje"
                value={conditionLabel}
                onEdit={() => goToStep(4)}
              />
            </dl>

            <div className="space-y-5 border-t border-white/15 pt-5">
              {!selectedVehicle ? (
                <div>
                  <label
                    htmlFor="trade-interest-text"
                    className="block font-display text-lg font-semibold text-cream"
                  >
                    Gostou de algum carro nosso?{" "}
                    <span className="font-body text-base font-normal text-cream/75">
                      (opcional)
                    </span>
                  </label>
                  <input
                    id="trade-interest-text"
                    name="interestText"
                    type="text"
                    maxLength={120}
                    value={interestText}
                    onChange={(event) => setInterestText(event.target.value)}
                    placeholder="Ex.: Corolla, HR-V, SUV automático (ou deixe em branco)"
                    className={`mt-2 ${fieldInputClass(false)}`}
                  />
                  <p className="mt-2 text-base leading-relaxed text-cream/80">
                    Quer olhar antes?{" "}
                    <Link
                      href="/estoque"
                      prefetch={false}
                      className="inline-flex min-h-[44px] items-center font-medium text-brand-light underline decoration-brand/50 underline-offset-4 hover:text-cream"
                    >
                      Ver nossos carros no estoque
                    </Link>
                  </p>
                </div>
              ) : null}

              <div>
                <label
                  htmlFor="trade-notes"
                  className="block font-display text-lg font-semibold text-cream"
                >
                  Quer contar mais algum detalhe?{" "}
                  <span className="font-body text-base font-normal text-cream/75">
                    (opcional)
                  </span>
                </label>
                <textarea
                  id="trade-notes"
                  name="notes"
                  rows={3}
                  maxLength={280}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ex.: único dono, pneus novos, revisão em dia (ou deixe em branco)"
                  aria-describedby="trade-notes-hint"
                  className={`mt-2 resize-y ${fieldInputClass(false)}`}
                />
                <p
                  id="trade-notes-hint"
                  className="mt-2 text-base leading-relaxed text-cream/80"
                >
                  Não coloque placa, CPF nem telefone aqui — combinamos os
                  detalhes direto no WhatsApp.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-6 border-t border-white/15 pt-6">
          {step < TRADE_STEP_COUNT ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex min-h-[54px] items-center justify-center border border-white/30 bg-asphalt px-6 py-3.5 font-display text-lg font-semibold text-cream transition hover:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light sm:w-auto touch-manipulation"
                >
                  Voltar
                </button>
              ) : null}

              <button
                type="submit"
                className="inline-flex min-h-[54px] flex-1 items-center justify-center gap-2.5 bg-brand px-7 py-3.5 font-display text-lg font-bold text-cream shadow-lg transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt active:bg-brand-dark touch-manipulation"
              >
                <span>Continuar</span>
                <IconArrowRight className="h-5 w-5 shrink-0" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="submit"
                className="inline-flex min-h-[58px] w-full items-center justify-center gap-3 bg-brand px-6 py-4 font-display text-lg font-bold text-cream shadow-lg transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt active:bg-brand-dark sm:text-xl touch-manipulation"
              >
                <IconWhatsApp className="h-6 w-6 shrink-0" />
                <span>Mandar pelo WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handleBack}
                className="inline-flex min-h-[50px] w-full items-center justify-center border border-white/30 bg-asphalt px-5 py-3 font-display text-base font-semibold text-cream transition hover:border-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light touch-manipulation"
              >
                Voltar para o passo anterior
              </button>

              {openedUrl ? (
                <p
                  role="status"
                  className="border border-brand/40 bg-asphalt p-4 text-base leading-relaxed text-cream"
                >
                  Abrimos o WhatsApp com os dados organizados. Se não apareceu
                  sozinho,{" "}
                  <a
                    href={openedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center font-semibold text-brand-light underline underline-offset-4 hover:text-cream"
                  >
                    toque aqui para abrir a conversa
                  </a>
                  .
                </p>
              ) : null}
            </div>
          )}

          <p className="mt-4 text-base leading-relaxed text-cream/80">
            Nada fica gravado no site. No fim, abrimos o WhatsApp da {site.name}{" "}
            ({site.whatsappLabel}) com tudo pronto pra você mandar.
          </p>
        </div>
      </section>
    </form>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-2.5 flex items-start gap-2.5 border-l-4 border-brand bg-brand/10 px-3.5 py-2.5 text-base font-medium leading-snug text-cream"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand font-display text-base font-bold leading-none text-cream"
      >
        !
      </span>
      <span>{message}</span>
    </p>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0">
        <dt className="text-base text-cream/75">{label}</dt>
        <dd className="mt-0.5 truncate font-display text-lg font-semibold text-cream">
          {value}
        </dd>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Mudar ${label.toLowerCase()}`}
        className="inline-flex min-h-[44px] min-w-[84px] shrink-0 items-center justify-center border border-white/25 bg-ink px-3.5 py-2 font-display text-base font-semibold text-brand-light transition hover:border-brand hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light touch-manipulation"
      >
        Mudar
      </button>
    </div>
  );
}
