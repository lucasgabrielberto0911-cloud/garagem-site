"use client";

import {
  useRef,
  useState,
  useTransition,
  Children,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import { notifyError, notifySuccess } from "@/lib/notify";
import { WhatsAppButton } from "@/components/site/ui";
import { createSellLead } from "@/app/(site)/vender/actions";
import { formatNumberBR, formatPhoneBR, formatPlateInput } from "@/lib/format";
import { prepareImageForUpload } from "@/lib/prepare-image-upload";
import { trackLead, trackPwaEvent } from "@/lib/meta-pixel";
import { enqueueIntent, isLikelyNetworkFailure } from "@/lib/offline-queue";
import { sellReceivedLine } from "@/lib/sell-receipt";
import { WHATSAPP_MESSAGES, site } from "@/lib/site";
import { SiteLeadHit } from "@/components/site/VehiclePixel";

const MAX_PHOTOS = 3;

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
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [outcome, setOutcome] = useState<null | "sent" | "queued">(null);
  const [sentPhotoCount, setSentPhotoCount] = useState(0);
  const [phone, setPhone] = useState("");
  const [km, setKm] = useState("");
  const [plate, setPlate] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  async function uploadSellPhotos(files: File[]) {
    const remaining = MAX_PHOTOS - photoUrls.length;
    const picked = files.slice(0, remaining);
    if (picked.length === 0) return;

    setPhotoBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of picked) {
        const prepared = await prepareImageForUpload(file);
        const body = new FormData();
        body.append("file", prepared, prepared.name || "foto.webp");
        const response = await fetch("/api/vender/photos", {
          method: "POST",
          body,
        });
        const data = (await response.json().catch(() => ({}))) as {
          url?: string;
          error?: string;
        };
        if (!response.ok || !data.url) {
          throw new Error(data.error || "Falha ao enviar a foto.");
        }
        uploaded.push(data.url);
      }
      setPhotoUrls((current) => [...current, ...uploaded].slice(0, MAX_PHOTOS));
    } catch (error) {
      notifyError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a foto. Tente de novo.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      window.requestAnimationFrame(() => {
        document.getElementById(first)?.focus();
      });
      return;
    }

    startTransition(async () => {
      const online = typeof navigator === "undefined" ? true : navigator.onLine;
      if (!online) {
        const fields: Record<string, string> = {};
        for (const [key, value] of data.entries()) {
          if (typeof value === "string") fields[key] = value;
        }
        await enqueueIntent({
          type: "sell",
          fields,
          photoUrls: (data.getAll("photoUrls") as string[]).filter(
            (item) => typeof item === "string",
          ),
        });
        trackPwaEvent("PwaOfflineQueued", { kind: "sell" });
        notifySuccess(
          "Sem conexão. Guardamos a avaliação e enviamos quando a internet voltar.",
        );
        setOutcome("queued");
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
          notifyError(result.message);
          const first = Object.keys(fieldErrors)[0];
          if (first) {
            window.requestAnimationFrame(() => {
              document.getElementById(first)?.focus();
            });
          }
        }
      } catch (error) {
        if (isLikelyNetworkFailure(error, navigator.onLine)) {
          const fields: Record<string, string> = {};
          for (const [key, value] of data.entries()) {
            if (typeof value === "string") fields[key] = value;
          }
          await enqueueIntent({
            type: "sell",
            fields,
            photoUrls: (data.getAll("photoUrls") as string[]).filter(
              (item) => typeof item === "string",
            ),
          });
          trackPwaEvent("PwaOfflineQueued", { kind: "sell" });
          notifySuccess(
            "Sem conexão. Guardamos a avaliação e enviamos quando a internet voltar.",
          );
          setOutcome("queued");
          return;
        }
        notifyError("Não foi possível enviar agora. Tente de novo.");
      }
    });
  }

  if (outcome) {
    return (
      <AfterSend
        mode={outcome}
        photoCount={sentPhotoCount}
        onAnother={() => {
          setSentPhotoCount(0);
          setOutcome(null);
        }}
      />
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="relative flex flex-col gap-3"
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
          <label htmlFor="photos" className="block">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Fotos do seu veículo{" "}
              <span className="normal-case font-normal">(opcional, até {MAX_PHOTOS})</span>
            </span>
            <span id="photos-hint" className="mb-3 block text-[11px] font-normal normal-case leading-relaxed tracking-normal text-muted">
              Ajudam na avaliação. Não precisa ser profissional — celular serve.
              Ficam só no pedido, sem ir para o site.
            </span>
            <span
              className={`flex min-h-[52px] items-center justify-center border border-dashed border-white/20 px-4 text-center font-display text-xs font-semibold uppercase tracking-wide text-cream touch-manipulation ${
                photoBusy || photoUrls.length >= MAX_PHOTOS
                  ? "opacity-60"
                  : "hover:border-brand"
              }`}
            >
              {photoBusy
                ? "Enviando foto…"
                : photoUrls.length >= MAX_PHOTOS
                  ? `Limite de ${MAX_PHOTOS} fotos`
                  : "Escolher fotos"}
            </span>
          </label>
          <input
            id="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={photoBusy || photoUrls.length >= MAX_PHOTOS}
            aria-describedby="photos-hint"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length === 0) return;
              void uploadSellPhotos(files);
            }}
            className="sr-only"
          />
          {photoUrls.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {photoUrls.map((url, index) => (
                <li
                  key={url}
                  className="flex min-h-11 items-center gap-2 border border-white/10 px-2.5 text-xs text-cream"
                >
                  Foto {index + 1}
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoUrls((current) =>
                        current.filter((item) => item !== url),
                      )
                    }
                    className="min-h-11 px-1 text-muted underline-offset-2 hover:text-cream hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {photoUrls.map((url) => (
            <input key={url} type="hidden" name="photoUrls" value={url} />
          ))}
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
        <div className="mt-4 flex flex-col gap-3">
          <button
            type="submit"
            disabled={isPending || photoBusy}
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
    </form>
  );
}

function AfterSend({
  mode,
  photoCount,
  onAnother,
}: {
  mode: "sent" | "queued";
  photoCount: number;
  onAnother: () => void;
}) {
  return (
    <div className="overflow-hidden border border-brand/40 bg-ink" aria-live="polite">
      <div className="h-1 bg-brand" aria-hidden="true" />
      <div className="p-4 sm:p-6">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
          {mode === "queued" ? "Sem conexão" : "Pedido recebido"}
        </p>
        <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-cream">
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
