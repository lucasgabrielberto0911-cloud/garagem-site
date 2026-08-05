"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSiteSettings } from "@/app/admin/site/actions";
import { Card, Field, btn, inputClass } from "@/components/admin/ui";
import type { EditableSiteFields } from "@/lib/site-settings";

export function SiteSettingsForm({
  initial,
}: {
  initial: EditableSiteFields;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
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

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Card title="Localização e contato público">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cidade / região" required error={errors.region}>
            <input
              name="region"
              defaultValue={initial.region.includes("[") ? "" : initial.region}
              placeholder="Ex.: Vitória"
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
            label="Endereço completo"
            required
            error={errors.address}
            className="sm:col-span-2"
          >
            <input
              name="address"
              defaultValue={
                initial.address.includes("[") ? "" : initial.address
              }
              placeholder="Rua, número, bairro — cidade/ES"
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
            hint="Texto curto, ex.: Seg–sex 9h–18h · Sáb 9h–13h"
            className="sm:col-span-2"
          >
            <input
              name="hours"
              defaultValue={initial.hours.includes("[") ? "" : initial.hours}
              placeholder="Seg–sex 9h–18h · Sáb 9h–13h"
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

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={btn.primary}>
          {isPending ? "Salvando…" : "Salvar dados do site"}
        </button>
        <p className="text-xs text-muted">
          Telefones, Instagram e CNPJ continuam em{" "}
          <code className="text-cream/80">src/lib/site.ts</code>.
        </p>
      </div>
    </form>
  );
}
