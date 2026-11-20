"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
  type Ref,
} from "react";
import { notifySuccess } from "@/lib/notify";
import { focusFormFeedback, useFormViewport } from "@/lib/form-feedback";
import { WhatsAppButton } from "@/components/site/ui";
import { createSellLead } from "@/app/(site)/vender/actions";
import {
  formatNumberBR,
  formatPhoneBR,
  formatPlateInput,
  isValidBrazilPhone,
  isValidPlate,
} from "@/lib/format";
import { HoneypotWebsiteField } from "@/components/site/HoneypotWebsiteField";
import { SellPhotoUpload } from "./SellPhotoUpload";
import { useSellDraft } from "./useSellDraft";
import { trackLead, trackPwaEvent } from "@/lib/meta-pixel";
import { normalizeBrazilPhone } from "@/lib/phone-br";
import { createIntentId, enqueueIntent, isLikelyNetworkFailure } from "@/lib/offline-queue";
import { sellReceivedLine } from "@/lib/sell-receipt";
import {
  getSellFormProgress,
  validateSellYear,
  type SellFormProgress,
} from "@/lib/sell-form-progress";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { SiteLeadHit } from "@/lib/funnel-events";

const baseInputClass =
  "w-full min-h-[56px] rounded-lg border bg-asphalt px-4 py-3.5 text-base leading-normal text-cream outline-none transition touch-manipulation placeholder:text-cream/55 focus:border-brand focus-visible:ring-2 focus-visible:ring-brand";

function inputToneClass(hasError: boolean) {
  return hasError
    ? `${baseInputClass} border-brand-light bg-brand/[0.06]`
    : `${baseInputClass} border-white/25 hover:border-white/40`;
}

const INITIAL_PROGRESS = getSellFormProgress({
  name: "",
  phone: "",
  brand: "",
  model: "",
  year: "",
});

export function SellForm({
  interestNote,
  interestVehicleId,
}: {
  interestNote?: string;
  interestVehicleId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  useFormViewport(formRef);
  const [isPending, startTransition] = useTransition();
  const [ready, setReady] = useState(false);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (isPending || !focusTarget) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(focusTarget)?.focus();
      setFocusTarget(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isPending, focusTarget]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<null | "sent" | "queued">(null);
  const [sentPhotoCount, setSentPhotoCount] = useState(0);
  const [sentVehicle, setSentVehicle] = useState<{
    brand: string;
    model: string;
    year: string;
  } | null>(null);
  const [phone, setPhone] = useState("");
  const [km, setKm] = useState("");
  const [plate, setPlate] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [progress, setProgress] = useState<SellFormProgress>(INITIAL_PROGRESS);
  const requestKeyRef = useRef(createIntentId());
  const draft = useSellDraft(formRef, outcome === null, setPhone, setKm, setPlate);

  const syncProgress = useCallback(
    (nextPhotoCount = photoUrls.length) => {
      const form = formRef.current;
      if (!form) return;
      const data = new FormData(form);
      setProgress(
        getSellFormProgress({
          name: String(data.get("name") ?? ""),
          phone: String(data.get("phone") ?? ""),
          brand: String(data.get("brand") ?? ""),
          model: String(data.get("model") ?? ""),
          year: String(data.get("year") ?? ""),
          plate: String(data.get("plate") ?? ""),
          km: String(data.get("km") ?? ""),
          notes: String(data.get("notes") ?? ""),
          photoCount: nextPhotoCount,
        }),
      );
    },
    [photoUrls.length],
  );

  useEffect(() => {
    if (outcome !== null) return;
    syncProgress(photoUrls.length);
  }, [outcome, draft.restored, draft.saved, phone, km, plate, photoUrls.length, syncProgress]);

  useEffect(() => {
    if (errors.plate && detailsRef.current) {
      detailsRef.current.open = true;
    }
  }, [errors.plate]);

  useEffect(() => {
    if (outcome) return focusFormFeedback(receiptRef.current);
  }, [outcome]);

  useEffect(() => {
    if (!isPending && !photoBusy) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isPending, photoBusy]);

  function clearFieldError(fieldName: string) {
    setErrors((current) => {
      if (!current[fieldName]) return current;
      const next = { ...current };
      delete next[fieldName];
      return next;
    });
    if (formError) setFormError("");
  }

  async function queueOffline(data: FormData) {
    const fields: Record<string, string> = {};
    for (const [key, value] of data.entries()) {
      if (typeof value === "string") fields[key] = value;
    }
    try {
      await enqueueIntent({
        type: "sell",
        fields,
        photoUrls: (data.getAll("photoUrls") as string[]).filter(
          (item) => typeof item === "string",
        ),
      });
      trackPwaEvent("PwaOfflineQueued", { kind: "sell" });
      notifySuccess("Sem conexão. Guardamos a avaliação e enviamos quando a internet voltar.");
      setOutcome("queued");
    } catch {
      const message = "Não conseguimos guardar a avaliação neste aparelho. Seus dados continuam no formulário. Tente de novo quando a conexão voltar ou chame no WhatsApp.";
      setFormError(message);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || photoBusy) return;
    setFormError("");
    const data = new FormData(event.currentTarget);
    if (!requestKeyRef.current) {
      requestKeyRef.current = createIntentId();
    }
    // Mesma chave em todas as tentativas desta solicitação (online, fila offline, reenvio).
    data.set("requestKey", requestKeyRef.current);
    data.set("requestId", requestKeyRef.current);
    const nextErrors: Record<string, string> = {};
    const name = String(data.get("name") ?? "").trim();
    const phoneRaw = String(data.get("phone") ?? "");
    const phoneDigits = phoneRaw.replace(/\D/g, "");
    const brand = String(data.get("brand") ?? "").trim();
    const model = String(data.get("model") ?? "").trim();
    const year = String(data.get("year") ?? "").trim();
    const plateValue = String(data.get("plate") ?? "").trim();
    if (name.length < 3) nextErrors.name = "Digite seu nome completo (pelo menos 3 letras).";
    if (!isValidBrazilPhone(phoneRaw) || !normalizeBrazilPhone(phoneDigits)) {
      nextErrors.phone = "Digite seu WhatsApp com DDD (10 ou 11 números).";
    }
    if (!brand) nextErrors.brand = "Digite a marca do veículo, como Volkswagen ou Honda.";
    if (!model) nextErrors.model = "Digite o modelo do veículo, como Gol ou Civic.";
    const yearError = validateSellYear(year);
    if (yearError) nextErrors.year = yearError;
    if (plateValue && !isValidPlate(plateValue)) {
      nextErrors.plate = "Confira a placa (ABC-1234 ou ABC1D23) ou deixe em branco.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      if (nextErrors.plate && detailsRef.current) {
        detailsRef.current.open = true;
      }
      const first = Object.keys(nextErrors)[0];
      setFocusTarget(first);
      return;
    }

    startTransition(async () => {
      const summary = { brand, model, year };
      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      if (!online) {
        setSentVehicle(summary);
        await queueOffline(data);
        return;
      }

      try {
        const result = await createSellLead(data);
        const fieldErrors = result.fieldErrors ?? {};
        setErrors(fieldErrors);

        if (result.ok) {
          trackLead({
            content_ids: [],
            content_name: "Vender/Trocar",
          });
          notifySuccess(result.message);
          setSentPhotoCount(photoUrls.length);
          setSentVehicle(summary);
          setOutcome("sent");
          requestKeyRef.current = createIntentId();
          setPhone("");
          setKm("");
          setPlate("");
          setPhotoUrls([]);
          setProgress(INITIAL_PROGRESS);
          formRef.current?.reset();
        } else {
          setFormError(result.message);
          const first = Object.keys(fieldErrors)[0];
          if (first) {
            if (first === "plate" && detailsRef.current) {
              detailsRef.current.open = true;
            }
            setFocusTarget(first);
          }
        }
      } catch (error) {
        if (isLikelyNetworkFailure(error, navigator.onLine)) {
          setSentVehicle(summary);
          await queueOffline(data);
          return;
        }
        const message = "Não foi possível enviar agora. Seus dados continuam no formulário. Tente de novo.";
        setFormError(message);
      }
    });
  }

  if (outcome) {
    return (
      <AfterSend
        containerRef={receiptRef}
        mode={outcome}
        photoCount={sentPhotoCount}
        vehicle={sentVehicle}
        onAnother={() => {
          setSentPhotoCount(0);
          setSentVehicle(null);
          setPhone("");
          setKm("");
          setPlate("");
          setPhotoUrls([]);
          setProgress(INITIAL_PROGRESS);
          requestKeyRef.current = createIntentId();
          setErrors({});
          setFormError("");
          setOutcome(null);
          setFocusTarget("name");
        }}
      />
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onInvalid={(event) => event.preventDefault()}
      onInput={(event) => {
        const target = event.target;
        if (
          (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
          target.name
        ) {
          clearFieldError(target.name);
        }
        syncProgress();
      }}
      onChange={() => {
        draft.remember();
        syncProgress();
      }}
      noValidate
      className="relative flex flex-col gap-4"
    >
      <fieldset disabled={isPending} className="flex min-w-0 flex-col gap-4">
        <ProgressCard progress={progress} />

        {draft.saved || draft.failed ? (
          <div
            className="rounded-xl border border-white/15 bg-ink px-4 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
            data-sell-draft=""
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" className="text-sm font-medium leading-relaxed text-cream">
                {draft.failure === "erase"
                  ? "Não conseguimos apagar o rascunho guardado neste navegador."
                  : draft.failed
                    ? "Não conseguimos guardar o preenchimento neste navegador."
                    : draft.restored
                      ? "Seu preenchimento foi recuperado."
                      : "Preenchimento guardado nesta aba."}
              </p>
              <button
                type="button"
                onClick={() => {
                  draft.discard();
                  setErrors({});
                  setFormError("");
                  setProgress(INITIAL_PROGRESS);
                }}
                className="min-h-11 rounded-lg border border-white/20 px-3.5 text-sm font-medium text-cream transition hover:border-brand hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                Apagar preenchimento
              </button>
            </div>
            {!draft.failed ? (
              <p className="mt-1.5 text-xs leading-relaxed text-cream/75">
                Os textos ficam guardados por até 24 horas nesta aba (se recarregar a página, escolha as fotos novamente).
              </p>
            ) : null}
          </div>
        ) : null}

        <HoneypotWebsiteField id="website" />

        <FormBlock
          step={1}
          title="Seus dados"
          hint="Nome e WhatsApp para retornarmos com a avaliação."
          done={progress.contactDone}
          summary={`${progress.contactCount}/2`}
        >
          <Field label="Seu nome" error={errors.name} htmlFor="name">
            <input
              id="name"
              name="name"
              required
              autoComplete="name"
              enterKeyHint="next"
              placeholder="Nome completo"
              className={inputToneClass(Boolean(errors.name))}
            />
          </Field>

          <Field label="WhatsApp com DDD" error={errors.phone} htmlFor="phone">
            <input
              id="phone"
              name="phone"
              required
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="next"
              value={phone}
              onChange={(event) => {
                clearFieldError("phone");
                setPhone(formatPhoneBR(event.target.value));
              }}
              placeholder="(00) 00000-0000"
              className={inputToneClass(Boolean(errors.phone))}
            />
          </Field>
        </FormBlock>

        <FormBlock
          step={2}
          title="Dados do veículo"
          hint="Só marca, modelo e ano para começar. Placa e fotos podem ficar para depois."
          done={progress.vehicleDone}
          summary={`${progress.vehicleCount}/3`}
        >
          <Field label="Marca do veículo" error={errors.brand} htmlFor="brand">
            <input
              id="brand"
              name="brand"
              required
              autoComplete="off"
              enterKeyHint="next"
              placeholder="Ex.: Volkswagen"
              className={inputToneClass(Boolean(errors.brand))}
            />
          </Field>

          <Field label="Modelo" error={errors.model} htmlFor="model">
            <input
              id="model"
              name="model"
              required
              autoComplete="off"
              enterKeyHint="next"
              placeholder="Ex.: Golf GTI"
              className={inputToneClass(Boolean(errors.model))}
            />
          </Field>

          <Field label="Ano" error={errors.year} htmlFor="year">
            <input
              id="year"
              name="year"
              required
              inputMode="numeric"
              maxLength={4}
              enterKeyHint="done"
              placeholder="Ex.: 2021"
              className={inputToneClass(Boolean(errors.year))}
            />
          </Field>
        </FormBlock>

        <details
          ref={detailsRef}
          className="group overflow-hidden rounded-xl border border-white/15 bg-ink shadow-[0_10px_28px_rgba(0,0,0,0.24)]"
        >
          <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-5 [&::-webkit-details-marker]:hidden">
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold ${
                  progress.optionalCount > 0
                    ? "bg-brand text-cream"
                    : "border border-white/20 bg-asphalt text-cream/85"
                }`}
              >
                {progress.optionalCount > 0 ? `+${progress.optionalCount}` : "3"}
              </span>
              <div className="min-w-0">
                <span className="block font-display text-base font-semibold leading-snug text-cream">
                  Complementar com placa, km ou fotos (opcional)
                </span>
                <span className="mt-0.5 block text-sm text-cream/75">
                  Toque para abrir só se quiser agilizar a avaliação.
                </span>
              </div>
            </div>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-asphalt text-base text-cream/80 transition-transform group-open:rotate-180"
            >
              ⌄
            </span>
          </summary>

          <div className="border-t border-white/10 p-4 sm:p-5">
            <p className="text-sm leading-relaxed text-cream/75">
              Nenhum destes campos é obrigatório. Se preferir, combinamos tudo pelo WhatsApp depois.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-5">
              <Field label="Placa do veículo" error={errors.plate} htmlFor="plate" optional>
                <input
                  id="plate"
                  name="plate"
                  autoComplete="off"
                  spellCheck={false}
                  value={plate}
                  onChange={(event) => {
                    clearFieldError("plate");
                    setPlate(formatPlateInput(event.target.value));
                  }}
                  placeholder="ABC-1234 ou ABC1D23"
                  className={`${inputToneClass(Boolean(errors.plate))} uppercase`}
                  aria-describedby="plate-hint"
                />
                <p id="plate-hint" className="mt-2 text-sm leading-snug text-cream/75">
                  Pode mandar depois. Se informar, use ABC-1234 ou ABC1D23.
                </p>
              </Field>

              <Field label="Quilometragem" error={errors.km} htmlFor="km" optional>
                <input
                  id="km"
                  name="km"
                  inputMode="numeric"
                  value={km}
                  onChange={(event) => {
                    clearFieldError("km");
                    const digits = event.target.value.replace(/\D/g, "");
                    setKm(digits ? formatNumberBR(Number(digits)) : "");
                  }}
                  placeholder="Ex.: 45.000"
                  className={inputToneClass(Boolean(errors.km))}
                />
              </Field>

              <div className="lg:col-span-2">
                <Field label="Observações" error={errors.notes} htmlFor="notes" optional>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    defaultValue={interestNote ?? ""}
                    placeholder="Conte o estado do veículo, itens extras, se quer vender ou trocar..."
                    className={`${inputToneClass(Boolean(errors.notes))} min-h-[120px] resize-y`}
                  />
                </Field>
              </div>

              <div className="lg:col-span-2">
                <SellPhotoUpload
                  disabled={isPending}
                  onBusyChange={setPhotoBusy}
                  onUrlsChange={setPhotoUrls}
                />
              </div>
            </div>
          </div>
        </details>

        {interestVehicleId ? (
          <input type="hidden" name="interestVehicleId" value={interestVehicleId} />
        ) : null}
        <input type="hidden" name="source" value="vender" />

        <div className="overflow-hidden rounded-xl border border-white/20 bg-ink shadow-[0_14px_36px_rgba(0,0,0,0.36)]">
          <div className="h-1 bg-brand-gradient" aria-hidden="true" />
          <div className="p-4 sm:p-6">
            <h3 className="font-display text-base font-bold text-cream sm:text-lg">
              O que acontece depois do envio
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-cream/85 sm:text-base">
              A gente analisa tabela, histórico e conservação e retorna no telefone
              informado pelo WhatsApp, das 8h às 23h — sem taxa e sem compromisso.
              Se precisar, pedimos placa ou fotos na conversa.
            </p>
            {formError ? (
              <p
                className="mt-4 rounded-lg border border-brand-light/40 bg-brand/10 px-4 py-3 text-sm font-medium leading-relaxed text-brand-light"
                role="alert"
              >
                {formError}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="submit"
                disabled={!ready || isPending || photoBusy}
                aria-busy={isPending}
                className="min-h-[56px] w-full rounded-lg bg-brand px-7 py-4 font-display text-base font-semibold uppercase tracking-wide text-cream shadow-[0_10px_24px_rgba(217,21,25,0.32)] transition hover:bg-brand-dark active:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-ink disabled:opacity-70 touch-manipulation"
              >
                {isPending
                  ? "Enviando..."
                  : photoBusy
                    ? "Enviando fotos… aguarde"
                    : "Solicitar avaliação"}
              </button>
              <SiteLeadHit contentName="Vender/Trocar">
                <WhatsAppButton
                  size="lg"
                  variant="outline"
                  className="w-full rounded-lg"
                  trackingLabel="vender"
                  message={WHATSAPP_MESSAGES.sell}
                >
                  Prefiro chamar no WhatsApp
                </WhatsAppButton>
              </SiteLeadHit>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-cream/75">
              Seus dados são usados apenas para o contato da avaliação. Não enviamos
              spam nem compartilhamos com terceiros.
            </p>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

function ProgressCard({ progress }: { progress: SellFormProgress }) {
  const pills = [
    {
      step: "1",
      label: "Seus dados",
      active: progress.contactDone,
      detail: progress.contactDone ? "Pronto" : `${progress.contactCount}/2`,
    },
    {
      step: "2",
      label: "Veículo",
      active: progress.vehicleDone,
      detail: progress.vehicleDone ? "Pronto" : `${progress.vehicleCount}/3`,
    },
    {
      step: "3",
      label: "Extras",
      active: progress.optionalCount > 0,
      detail:
        progress.optionalCount > 0 ? `+${progress.optionalCount}` : "Opcional",
    },
  ];

  return (
    <div
      className="rounded-xl border border-white/15 bg-ink p-4 shadow-[0_8px_24px_rgba(0,0,0,0.24)] sm:p-5"
      data-sell-progress=""
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-sm font-semibold text-cream sm:text-base">
          {progress.statusText}
        </p>
        <span className="font-display text-sm font-bold text-brand-light">
          {progress.essentialFilled} de {progress.essentialTotal}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Progresso dos campos essenciais"
        aria-valuemin={0}
        aria-valuemax={progress.essentialTotal}
        aria-valuenow={progress.essentialFilled}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10"
      >
        <div
          className="h-full rounded-full bg-brand-gradient transition-[width] duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <ol className="mt-3.5 grid grid-cols-3 gap-1.5 sm:gap-2">
        {pills.map((item) => (
          <li
            key={item.step}
            className={`min-w-0 rounded-lg border px-2 py-2 text-left transition sm:px-3 ${
              item.active
                ? "border-brand/50 bg-brand/[0.12]"
                : "border-white/10 bg-asphalt/80"
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span
                className={`font-display text-xs font-bold ${
                  item.active ? "text-brand-light" : "text-cream/75"
                }`}
              >
                {item.active && item.step !== "3" ? "✓" : item.step}
              </span>
              <span className="truncate text-[11px] font-medium text-cream/75">
                {item.detail}
              </span>
            </div>
            <p className="mt-0.5 truncate font-display text-xs font-semibold text-cream sm:text-sm">
              {item.label}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function AfterSend({
  containerRef,
  mode,
  photoCount,
  vehicle,
  onAnother,
}: {
  containerRef: Ref<HTMLDivElement>;
  mode: "sent" | "queued";
  photoCount: number;
  vehicle: { brand: string; model: string; year: string } | null;
  onAnother: () => void;
}) {
  const whatsAppMessage = vehicle
    ? `Olá! Acabei de enviar os dados do meu ${vehicle.brand} ${vehicle.model} ${vehicle.year} pelo site para avaliação.`
    : WHATSAPP_MESSAGES.sell;
  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      aria-labelledby="sell-form-receipt-heading"
      className="scroll-mt-24 overflow-hidden rounded-xl border border-brand/40 bg-ink shadow-[0_14px_36px_rgba(0,0,0,0.36)] outline-none"
      aria-live="polite"
    >
      <div className="h-1 bg-brand-gradient" aria-hidden="true" />
      <div className="p-5 sm:p-6">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-brand-light">
          {mode === "queued" ? "Sem conexão" : "Pedido recebido"}
        </p>
        <h2
          id="sell-form-receipt-heading"
          className="mt-2 font-display text-2xl font-bold tracking-tight text-cream"
        >
          {mode === "queued" ? "Avaliação guardada neste aparelho" : "Solicitação enviada"}
        </h2>
        {vehicle ? (
          <p className="mt-2 inline-flex rounded-lg border border-white/15 bg-asphalt px-3.5 py-2 font-display text-sm font-semibold text-cream">
            {vehicle.brand} {vehicle.model} {vehicle.year}
          </p>
        ) : null}
        {mode === "queued" ? (
          <p className="mt-3 text-base leading-relaxed text-cream/85">
            Sem conexão. Guardamos a avaliação e enviamos quando a internet voltar.
          </p>
        ) : (
          <ol className="mt-4 grid gap-2.5">
            <li className="rounded-lg border border-white/15 bg-asphalt px-4 py-3.5 text-sm leading-relaxed text-cream/85 sm:text-base">
              <span className="font-display font-semibold text-cream">
                1. Recebemos os dados do veículo.
              </span>{" "}
              {sellReceivedLine(photoCount)}
            </li>
            <li className="rounded-lg border border-white/15 bg-asphalt px-4 py-3.5 text-sm leading-relaxed text-cream/85 sm:text-base">
              <span className="font-display font-semibold text-cream">
                2. A loja avalia sem taxa e sem compromisso.
              </span>{" "}
              Tabela, histórico e estado de conservação.
            </li>
            <li className="rounded-lg border border-white/15 bg-asphalt px-4 py-3.5 text-sm leading-relaxed text-cream/85 sm:text-base">
              <span className="font-display font-semibold text-cream">
                3. O retorno sai no telefone informado, das 8h às 23h.
              </span>{" "}
              Se quiser adiantar, chame no WhatsApp {site.phoneLabel}.
            </li>
          </ol>
        )}
        <div className="mt-5 flex flex-col gap-3">
          <WhatsAppButton
            size="lg"
            className="w-full rounded-lg"
            trackingLabel="vender"
            message={whatsAppMessage}
          >
            Chamar no WhatsApp
          </WhatsAppButton>
          <button
            type="button"
            onClick={onAnother}
            className="min-h-[56px] w-full rounded-lg border border-white/25 px-5 py-3.5 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand touch-manipulation"
          >
            Enviar outro veículo
          </button>
        </div>
      </div>
    </div>
  );
}

function FormBlock({
  step,
  title,
  hint,
  done,
  summary,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  done?: boolean;
  summary?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border bg-ink p-4 shadow-[0_10px_28px_rgba(0,0,0,0.26)] transition sm:p-5 ${
        done ? "border-brand/45" : "border-white/15"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-bold ${
              done
                ? "bg-brand text-cream shadow-[0_4px_12px_rgba(217,21,25,0.35)]"
                : "border border-brand/40 bg-brand/15 text-brand-light"
            }`}
          >
            {done ? "✓" : step}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold leading-snug text-cream">
              {title}
            </h3>
            {hint ? (
              <p className="mt-1 text-sm leading-relaxed text-cream/75">{hint}</p>
            ) : null}
          </div>
        </div>
        {summary ? (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 font-display text-xs font-semibold ${
              done
                ? "bg-brand/20 text-brand-light"
                : "border border-white/15 bg-asphalt text-cream/75"
            }`}
          >
            {done ? "Pronto" : summary}
          </span>
        ) : null}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-5">
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
  children: React.ReactNode;
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
      return cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": describedBy || undefined,
      });
    }
    return child;
  });
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-2 flex flex-wrap items-baseline gap-1.5 text-base font-semibold leading-snug text-cream"
      >
        <span>{label}</span>
        {optional ? (
          <span className="text-sm font-normal text-cream/70">(opcional)</span>
        ) : (
          <span className="text-brand-light" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {decorated}
      {error ? (
        <p
          id={errorId}
          className="mt-2 flex items-start gap-2 rounded-md border border-brand-light/35 bg-brand/10 px-3 py-2 text-sm font-medium leading-snug text-brand-light"
          role="alert"
        >
          <span aria-hidden="true" className="shrink-0 font-display font-bold">
            !
          </span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
