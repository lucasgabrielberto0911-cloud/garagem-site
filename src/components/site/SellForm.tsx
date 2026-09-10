"use client";

import { useRef, useState, useTransition, Children, cloneElement, isValidElement } from "react";
import { toast } from "sonner";
import { WhatsAppButton } from "@/components/site/ui";
import { createSellLead } from "@/app/(site)/vender/actions";
import { formatNumberBR, formatPhoneBR, formatPlateInput } from "@/lib/format";
import { prepareImageForUpload } from "@/lib/prepare-image-upload";
import { trackLead } from "@/lib/meta-pixel";
import { WHATSAPP_MESSAGES } from "@/lib/site";
import { SiteLeadHit } from "@/components/site/VehiclePixel";

const MAX_PHOTOS = 3;

const inputClass =
  "w-full min-h-[48px] border border-white/10 bg-asphalt px-3.5 py-3 text-base text-cream outline-none transition placeholder:text-muted focus:border-brand sm:min-h-[52px]";

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
  const [sent, setSent] = useState(false);
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
      toast.error(
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
      const result = await createSellLead(data);
      const fieldErrors = result.fieldErrors ?? {};
      setErrors(fieldErrors);

      if (result.ok) {
        trackLead({
          content_ids: [],
          content_name: "Vender/Trocar",
        });
        toast.success(result.message);
        setSent(true);
        setPhone("");
        setKm("");
        setPlate("");
        setPhotoUrls([]);
        formRef.current?.reset();
      } else {
        toast.error(result.message);
        const first = Object.keys(fieldErrors)[0];
        if (first) {
          window.requestAnimationFrame(() => {
            document.getElementById(first)?.focus();
          });
        }
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
          <WhatsAppButton trackingLabel="vender" message={WHATSAPP_MESSAGES.sell}>
            Chamar no WhatsApp
          </WhatsAppButton>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="min-h-[48px] border border-white/20 px-5 py-3 font-display text-xs font-semibold uppercase tracking-wide text-cream transition hover:border-brand hover:bg-white/5"
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
      className="relative border border-white/10 bg-ink p-6 sm:p-8 lg:p-10"
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

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-6">
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

        <div className="sm:col-span-2">
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

        <div className="sm:col-span-2">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted">
            Fotos do seu veículo <span className="normal-case">(opcional, até {MAX_PHOTOS})</span>
          </p>
          <p className="mb-3 text-[11px] leading-relaxed text-muted">
            Ajudam na avaliação. Não precisa ser profissional — celular serve.
            Ficam só no pedido, sem ir para o site.
          </p>
          <input
            id="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={photoBusy || photoUrls.length >= MAX_PHOTOS}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (files.length === 0) return;
              void uploadSellPhotos(files);
            }}
            className="block w-full text-sm text-muted file:mr-3 file:min-h-[40px] file:border-0 file:bg-white/10 file:px-3 file:text-xs file:uppercase file:tracking-wide file:text-cream"
          />
          {photoBusy ? (
            <p className="mt-2 text-xs text-muted">Enviando foto…</p>
          ) : null}
          {photoUrls.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {photoUrls.map((url, index) => (
                <li
                  key={url}
                  className="flex items-center gap-2 border border-white/10 px-2 py-1.5 text-xs text-cream"
                >
                  Foto {index + 1}
                  <button
                    type="button"
                    onClick={() =>
                      setPhotoUrls((current) =>
                        current.filter((item) => item !== url),
                      )
                    }
                    className="text-muted underline-offset-2 hover:text-cream hover:underline"
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
      </div>

      {interestVehicleId ? (
        <input type="hidden" name="interestVehicleId" value={interestVehicleId} />
      ) : null}
      <input type="hidden" name="source" value="vender" />

      <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={isPending || photoBusy}
          aria-busy={isPending}
          className="min-h-[52px] bg-brand px-7 py-4 font-display text-sm font-semibold uppercase tracking-wide text-cream transition hover:bg-[#c91418] disabled:opacity-70"
        >
          {isPending ? "Enviando..." : "Solicitar avaliação"}
        </button>
        <SiteLeadHit contentName="Vender/Trocar">
          <WhatsAppButton
            size="lg"
            variant="outline"
            trackingLabel="vender"
            message={WHATSAPP_MESSAGES.sell}
          >
            Prefiro chamar no WhatsApp
          </WhatsAppButton>
        </SiteLeadHit>
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
        className="mb-2 block text-xs uppercase tracking-wider text-muted"
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
