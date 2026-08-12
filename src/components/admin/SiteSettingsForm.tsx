"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSiteSettings } from "@/app/admin/site/actions";
import { cleanupOrphanPhotos } from "@/app/admin/site/cleanup-actions";
import { Card, Field, btn, inputClass } from "@/components/admin/ui";
import type { EditableSiteFields } from "@/lib/site-settings";

export function SiteSettingsForm({
  initial,
}: {
  initial: EditableSiteFields;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cleanupPending, startCleanup] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateSiteSettings(formData);
      setErrors(result.fieldErrors ?? {});
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function runCleanup() {
    startCleanup(async () => {
      const result = await cleanupOrphanPhotos();
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Card title="Localização e contato público">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cidade / região" required error={errors.region}>
            <input
              name="region"
              defaultValue={initial.region.includes("[") ? "" : initial.region}
              placeholder="Ex.: Aracruz, Vitória, Linhares"
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

      <Card title="Horários de atendimento">
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
          <Field label="Anos de história" hint='Ex.: +20'>
            <input
              name="aboutYears"
              defaultValue={initial.aboutYears}
              placeholder="+20"
              className={inputClass}
            />
          </Field>
          <Field label="Atendimento" hint='Ex.: 8h–23h'>
            <input
              name="aboutHours"
              defaultValue={initial.aboutHours}
              placeholder="8h–23h"
              className={inputClass}
            />
          </Field>
          <Field label="Foco no cliente" hint='Ex.: 100%'>
            <input
              name="aboutFocus"
              defaultValue={initial.aboutFocus}
              placeholder="100%"
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={btn.primary}>
          {isPending ? "Salvando…" : "Salvar dados do site"}
        </button>
        <p className="text-xs text-muted">
          Telefones, Instagram e CNPJ continuam em{" "}
          <code className="text-cream/80">src/lib/site.ts</code>.
        </p>
      </div>

      <Card title="Manutenção de fotos">
        <p className="text-sm leading-relaxed text-muted">
          Remove do Storage fotos que não estão ligadas a nenhum anúncio
          (órfãs de edições antigas ou uploads cancelados).
        </p>
        <button
          type="button"
          disabled={cleanupPending}
          onClick={runCleanup}
          className={`${btn.outline} mt-4`}
        >
          {cleanupPending ? "Limpando…" : "Limpar fotos órfãs"}
        </button>
      </Card>
    </form>
  );
}
