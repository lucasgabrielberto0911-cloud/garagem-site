"use client";

import {
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
import { notifyError, notifySuccess } from "@/lib/notify";
import { focusFormFeedback, useFormViewport } from "@/lib/form-feedback";
import { WhatsAppButton } from "@/components/site/ui";
import { createSellLead } from "@/app/(site)/vender/actions";
import { formatNumberBR, formatPhoneBR, formatPlateInput } from "@/lib/format";
import { SellPhotoUpload } from "./SellPhotoUpload";
import { useSellDraft } from "./useSellDraft";
import { trackLead, trackPwaEvent } from "@/lib/meta-pixel";
import { enqueueIntent, isLikelyNetworkFailure } from "@/lib/offline-queue";
import { sellReceivedLine } from "@/lib/sell-receipt";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { SiteLeadHit } from "@/components/site/VehiclePixel";

const inputClass =
  "w-full min-h-[48px] border border-white/10 bg-asphalt px-3.5 py-3 text-base text-cream outline-none transition touch-manipulation placeholder:text-muted focus:border-brand";

export function SellForm({
  interestNote,
  interestVehicleId,
}: {
  interestNote?: string;
  interestVehicleId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
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
  const [phone, setPhone] = useState("");
  const [km, setKm] = useState("");
  const [plate, setPlate] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const draft = useSellDraft(formRef, outcome === null, setPhone, setKm, setPlate);

  useEffect(() => {
    if (outcome) return focusFormFeedback(receiptRef.current);
  }, [outcome]);

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
      notifyError(message);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || photoBusy) return;
    setFormError("");
    const data = new FormData(event.currentTarget);
    const nextErrors: Record<string, string> = {};
    const name = String(data.get("name") ?? "").trim();
    const phoneDigits = String(data.get("phone") ?? "").replace(/\D/g, "");
    const brand = String(data.get("brand") ?? "").trim();
    const model = String(data.get("model") ?? "").trim();
    const year = String(data.get("year") ?? "").trim();
    const plate = String(data.get("plate") ?? "").trim();
    if (name.length < 3) nextErrors.name = "Informe seu nome completo.";
    if (phoneDigits.length < 10) nextErrors.phone = "Informe um WhatsApp com DDD.";
    if (!brand) nextErrors.brand = "Informe a marca.";
    if (!model) nextErrors.model = "Informe o modelo.";
    if (!/^\d{4}$/.test(year)) nextErrors.year = "Informe o ano com 4 dígitos.";
    if (!plate) nextErrors.plate = "Informe a placa.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const first = Object.keys(nextErrors)[0];
      setFocusTarget(first);
      return;
    }

    startTransition(async () => {
      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      if (!online) {
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
          setOutcome("sent");
          setPhone("");
          setKm("");
          setPlate("");
          setPhotoUrls([]);
          formRef.current?.reset();
        } else {
          setFormError(result.message);
          notifyError(result.message);
          const first = Object.keys(fieldErrors)[0];
          if (first) {
            setFocusTarget(first);
          }
        }
      } catch (error) {
        if (isLikelyNetworkFailure(error, navigator.onLine)) {
          await queueOffline(data);
          return;
        }
        const message = "Não foi possível enviar agora. Seus dados continuam no formulário. Tente de novo.";
        setFormError(message);
        notifyError(message);
      }
    });
  }

  if (outcome) {
    return (
      <AfterSend
        containerRef={receiptRef}
        mode={outcome}
        photoCount={sentPhotoCount}
        onAnother={() => {
          setSentPhotoCount(0);
          setPhone("");
          setKm("");
          setPlate("");
          setPhotoUrls([]);
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
      onChange={draft.remember}
      noValidate
      className="relative flex flex-col gap-3"
    >
      <fieldset disabled={isPending} className="flex min-w-0 flex-col gap-3">
        {draft.saved || draft.failed ? (
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5" data-sell-draft="">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p role="status" className="text-xs leading-relaxed text-muted">
                {draft.failure === "erase" ? "Não conseguimos apagar o rascunho guardado neste navegador." : draft.failed ? "Não conseguimos guardar o preenchimento neste navegador." : draft.restored ? "Seu preenchimento foi recuperado." : "Preenchimento guardado nesta aba."}
              </p>
              <button type="button" onClick={() => { draft.discard(); setErrors({}); setFormError(""); }}
                className="min-h-11 text-xs text-cream underline decoration-white/30 underline-offset-4">Apagar preenchimento</button>
            </div>
            {!draft.failed ? <p className="text-[11px] leading-relaxed text-muted">Até fechar a aba, por até 24 horas. Ao voltar, selecione as fotos novamente.</p> : null}
          </div>
        ) : null}
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

        <FormBlock title="Seus dados" hint="Nome e telefone para o retorno.">
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
        </FormBlock>

        <FormBlock title="O veículo" hint="Marca, modelo, ano e placa são obrigatórios.">
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

          <Field label="Placa do veículo" error={errors.plate} htmlFor="plate">
            <input
              id="plate"
              name="plate"
              required
              autoComplete="off"
              spellCheck={false}
              value={plate}
              onChange={(event) => setPlate(formatPlateInput(event.target.value))}
              placeholder="ABC-1234 ou ABC1D23"
              className={`${inputClass} uppercase`}
              aria-describedby="plate-hint"
            />
            <p id="plate-hint" className="mt-1.5 text-[11px] text-muted">
              Aceita placa antiga (ABC-1234) ou Mercosul (ABC1D23).
            </p>
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
        </FormBlock>

        <FormBlock title="Fotos e observações">
          <div className="lg:col-span-2">
            <Field label="Observações" error={errors.notes} htmlFor="notes" optional>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={interestNote ?? ""}
                placeholder="Conte o estado do veículo, itens opcionais, se há débitos, se quer vender ou trocar..."
                className={`${inputClass} resize-y`}
              />
            </Field>
          </div>

          <div className="lg:col-span-2">
            <SellPhotoUpload disabled={isPending} onBusyChange={setPhotoBusy} onUrlsChange={setPhotoUrls} />
          </div>
        </FormBlock>

        {interestVehicleId ? (
          <input type="hidden" name="interestVehicleId" value={interestVehicleId} />
        ) : null}
        <input type="hidden" name="source" value="vender" />

        <div className="border border-white/10 bg-ink p-4 sm:p-5">
          <p className="text-sm leading-relaxed text-muted">
            Depois do envio, avaliamos tabela, histórico e conservação e
            retornamos no telefone informado, das 8h às 23h. Sem taxa e sem
            compromisso.
          </p>
          {formError ? <p className="mt-4 text-sm leading-relaxed text-brand" role="alert">{formError}</p> : null}
          <div className="mt-4 flex flex-col gap-3">
            <button
              type="submit"
              disabled={!ready || isPending || photoBusy}
              aria-busy={isPending}
              className="min-h-[52px] w-full bg-brand px-7 py-4 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:opacity-70 touch-manipulation"
            >
              {isPending ? "Enviando..." : "Solicitar avaliação"}
            </button>
            <SiteLeadHit contentName="Vender/Trocar">
              <WhatsAppButton
                size="lg"
                variant="outline"
                className="w-full"
                trackingLabel="vender"
                message={WHATSAPP_MESSAGES.sell}
              >
                Prefiro chamar no WhatsApp
              </WhatsAppButton>
            </SiteLeadHit>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Seus dados são usados apenas para o contato da avaliação. Não enviamos
            spam nem compartilhamos com terceiros.
          </p>
        </div>
      </fieldset>
    </form>
  );
}

function AfterSend({
  containerRef,
  mode,
  photoCount,
  onAnother,
}: {
  containerRef: Ref<HTMLDivElement>;
  mode: "sent" | "queued";
  photoCount: number;
  onAnother: () => void;
}) {
  return (
    <div ref={containerRef} tabIndex={-1} aria-labelledby="sell-form-receipt-heading" className="scroll-mt-24 overflow-hidden border border-brand/40 bg-ink outline-none" aria-live="polite">
      <div className="h-1 bg-brand" aria-hidden="true" />
      <div className="p-4 sm:p-6">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
          {mode === "queued" ? "Sem conexão" : "Pedido recebido"}
        </p>
        <h2 id="sell-form-receipt-heading" className="mt-2 font-display text-xl font-bold tracking-tight text-cream">
          {mode === "queued" ? "Avaliação guardada neste aparelho" : "Solicitação enviada"}
        </h2>
        {mode === "queued" ? (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Sem conexão. Guardamos a avaliação e enviamos quando a internet voltar.
          </p>
        ) : (
          <ol className="mt-4 grid gap-1.5">
            <li className="border border-white/10 bg-asphalt px-3.5 py-3 text-sm leading-snug text-muted">
              <span className="font-display font-semibold text-cream">
                Recebemos os dados do veículo.
              </span>{" "}
              {sellReceivedLine(photoCount)}
            </li>
            <li className="border border-white/10 bg-asphalt px-3.5 py-3 text-sm leading-snug text-muted">
              <span className="font-display font-semibold text-cream">
                A loja avalia sem taxa e sem compromisso.
              </span>{" "}
              Tabela, histórico e estado de conservação.
            </li>
            <li className="border border-white/10 bg-asphalt px-3.5 py-3 text-sm leading-snug text-muted">
              <span className="font-display font-semibold text-cream">
                O retorno sai no telefone informado, das 8h às 23h.
              </span>{" "}
              Se quiser adiantar, chame no WhatsApp {site.phoneLabel}.
            </li>
          </ol>
        )}
        <div className="mt-4 flex flex-col gap-3">
          <WhatsAppButton
            size="lg"
            className="w-full"
            trackingLabel="vender"
            message={WHATSAPP_MESSAGES.sell}
          >
            Chamar no WhatsApp
          </WhatsAppButton>
          <button
            type="button"
            onClick={onAnother}
            className="min-h-[48px] w-full border border-white/20 px-5 py-3 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-white/5 touch-manipulation"
          >
            Enviar outro veículo
          </button>
        </div>
      </div>
    </div>
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
    <section className="border border-white/10 bg-ink p-4 sm:p-5">
      <h3 className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
        {title}
      </h3>
      {hint ? <p className="mt-1 text-sm leading-snug text-muted">{hint}</p> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:gap-x-5">{children}</div>
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
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted"
      >
        {label}
        {optional ? (
          <span className="ml-1 normal-case">(opcional)</span>
        ) : (
          <span className="ml-1 text-brand" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {decorated}
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-brand" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
