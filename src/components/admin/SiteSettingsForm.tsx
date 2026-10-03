"use client";

import { useUnsavedChangesWarning } from "@/components/admin/useUnsavedChangesWarning";
import { adminMutation } from "@/lib/admin-mutation";
import { focusAdminError } from "@/lib/admin-form-focus";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSiteSettings } from "@/app/admin/site/actions";
import {
  cleanupOrphanPhotos,
  backfillMissingThumbnails,
} from "@/app/admin/site/cleanup-actions";
import { SiteContentEditor } from "@/components/admin/SiteContentEditor";
import { Card, Field, btn, inputClass } from "@/components/admin/ui";
import type { SiteContent } from "@/lib/site-content";
import type { EditableSiteFields } from "@/lib/site-settings";

export function SiteSettingsForm({
  initial,
  content,
}: {
  initial: EditableSiteFields;
  content: SiteContent;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cleanupPending, startCleanup] = useTransition();
  const [thumbsPending, startThumbs] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  useUnsavedChangesWarning(dirty || uploading);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading || isPending) return;
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await adminMutation(() => updateSiteSettings(formData));
      setErrors(result.fieldErrors ?? {});
      if (result.ok) {
        setDirty(false);
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
        const first = Object.keys(result.fieldErrors ?? {})[0];
        if (first) focusAdminError(form, first);
      }
    });
  }

  function runThumbs() {
    startThumbs(async () => {
      const result = await adminMutation(() => backfillMissingThumbnails());
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.message);
    });
  }

  function runCleanup() {
    startCleanup(async () => {
      const preview = await adminMutation(() => cleanupOrphanPhotos());
      if (!preview.ok) {
        toast.error(preview.message);
        return;
      }
      if (!preview.candidates?.length) {
        toast.success(preview.message);
        return;
      }
      if (
        !window.confirm(
          `${preview.message}\nRemover somente esses arquivos? Esta ação não pode ser desfeita.`,
        )
      )
        return;
      const result = await adminMutation(() =>
        cleanupOrphanPhotos(preview.candidates),
      );
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <form
      onSubmit={submit}
      onChange={() => setDirty(true)}
      className="space-y-4 pb-36 lg:pb-0"
      noValidate
    >
      <fieldset disabled={isPending || uploading} className="min-w-0 space-y-4">
        <Card title="Localização e contato público">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cidade / região" required error={errors.region}>
              <input
                name="region"
                defaultValue={
                  initial.region.includes("[") ? "" : initial.region
                }
                placeholder="Ex.: Aracruz, Vitória, Linhares, Serra, Vila Velha"
                className={inputClass}
                aria-invalid={Boolean(errors.region)}
              />
            </Field>
            <Field
              label="E-mail público"
              error={errors.email}
              hint="Aparece no rodapé e na página de contato."
            >
              <input
                name="email"
                type="email"
                defaultValue={initial.email.includes("[") ? "" : initial.email}
                placeholder="contato@suagaragem.net"
                className={inputClass}
                aria-invalid={Boolean(errors.email)}
              />
            </Field>
            <Field
              label="Endereço / modalidade"
              required
              error={errors.address}
              hint='Loja digital: use "Loja digital — atendimento online". Com showroom, informe o endereço completo.'
              className="sm:col-span-2"
            >
              <input
                name="address"
                defaultValue={
                  initial.address.includes("[") ? "" : initial.address
                }
                placeholder="Loja digital — atendimento online"
                className={inputClass}
                aria-invalid={Boolean(errors.address)}
              />
            </Field>
          </div>
        </Card>

        <Card collapsed title="Horários de atendimento">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Resumo (home / listagens)"
              required
              error={errors.hours}
              hint="Texto curto, ex.: Todos os dias, 8h às 23h (online)"
              className="sm:col-span-2"
            >
              <input
                name="hours"
                defaultValue={initial.hours.includes("[") ? "" : initial.hours}
                placeholder="Todos os dias, 8h às 23h (online)"
                className={inputClass}
                aria-invalid={Boolean(errors.hours)}
              />
            </Field>
            <Field
              label="Segunda a sexta"
              required
              error={errors.hoursWeekdays}
            >
              <input
                name="hoursWeekdays"
                defaultValue={
                  initial.hoursWeekdays.includes("[")
                    ? ""
                    : initial.hoursWeekdays
                }
                placeholder="09:00 – 18:00"
                className={inputClass}
                aria-invalid={Boolean(errors.hoursWeekdays)}
              />
            </Field>
            <Field label="Sábado" required error={errors.hoursSaturday}>
              <input
                name="hoursSaturday"
                defaultValue={
                  initial.hoursSaturday.includes("[")
                    ? ""
                    : initial.hoursSaturday
                }
                placeholder="09:00 – 13:00"
                className={inputClass}
                aria-invalid={Boolean(errors.hoursSaturday)}
              />
            </Field>
          </div>
        </Card>

        <Card
          collapsed
          title="Números da home e Sobre"
          action={
            <span className="text-xs text-muted">
              Base + contagem real do sistema
            </span>
          }
        >
          <p className="mb-4 text-sm leading-relaxed text-muted">
            As bases somam com o que já está no sistema: cada carro disponível
            aumenta o estoque da home; cada venda registrada aumenta os negócios
            fechados (home) e os carros vendidos (Sobre).
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Base de estoque (home)"
              hint="Soma com veículos disponíveis"
            >
              <input
                name="statsStockBase"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                defaultValue={initial.statsStockBase}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field
              label="Base de vendas (home + Sobre)"
              hint="Soma com vendas registradas"
            >
              <input
                name="statsSalesBase"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                defaultValue={initial.statsSalesBase}
                placeholder="0"
                className={inputClass}
              />
            </Field>
            <Field label="Anos de história" hint="Ex.: +20">
              <input
                name="aboutYears"
                defaultValue={initial.aboutYears}
                placeholder="+20"
                className={inputClass}
              />
            </Field>
            <Field label="Atendimento" hint="Ex.: 8h–23h">
              <input
                name="aboutHours"
                defaultValue={initial.aboutHours}
                placeholder="8h–23h"
                className={inputClass}
              />
            </Field>
            <Field label="Foco no cliente" hint="Ex.: 100%">
              <input
                name="aboutFocus"
                defaultValue={initial.aboutFocus}
                placeholder="100%"
                className={inputClass}
              />
            </Field>
          </div>
        </Card>

        <SiteContentEditor
          initial={content}
          errors={errors}
          onUploadingChange={setUploading}
          onDirty={() => setDirty(true)}
        />

        <div className="fixed inset-x-0 bottom-admin-nav z-20 mt-2 border-t border-white/10 bg-ink/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:pb-0">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending || uploading}
              className={`${btn.primary} w-full sm:w-auto`}
            >
              {isPending
                ? "Salvando…"
                : uploading
                  ? "Aguarde a foto…"
                  : "Salvar dados do site"}
            </button>
            <p role="status" className="text-xs text-muted">
              {dirty ? "Alterações não salvas" : "Dados salvos"} · WhatsApp e
              Instagram oficiais preservados.
            </p>
          </div>
        </div>

        <Card collapsed title="Manutenção de fotos">
          <p className="text-sm leading-relaxed text-muted">
            Miniaturas 480×300 deixam o estoque e a ficha mais leves no celular.
            Fotos antigas ainda não têm capa gravada — gere em lotes de 20.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={thumbsPending}
              onClick={runThumbs}
              className={btn.primary}
            >
              {thumbsPending
                ? "Gerando miniaturas…"
                : "Gerar miniaturas faltantes"}
            </button>
            <button
              type="button"
              disabled={cleanupPending}
              onClick={runCleanup}
              className={btn.outline}
            >
              {cleanupPending ? "Limpando…" : "Limpar fotos órfãs"}
            </button>
          </div>
        </Card>
      </fieldset>
    </form>
  );
}
