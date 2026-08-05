"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, Field, btn, inputClass } from "@/components/admin/ui";
import {
  changeAdminPassword,
  updateAdminProfile,
} from "@/app/admin/conta/actions";

export function AccountForms({
  name,
  email,
  usingSeedPassword,
}: {
  name: string;
  email: string;
  usingSeedPassword: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateAdminProfile(formData);
      setProfileErrors(result.fieldErrors ?? {});
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function submitPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await changeAdminPassword(formData);
      setPasswordErrors(result.fieldErrors ?? {});
      if (result.ok) {
        toast.success(result.message);
        form.reset();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Meus dados">
        <form onSubmit={submitProfile} className="space-y-4" noValidate>
          <Field label="Nome" required error={profileErrors.name}>
            <input
              name="name"
              defaultValue={name}
              className={inputClass}
              placeholder="Seu nome"
            />
          </Field>
          <Field
            label="E-mail de acesso"
            required
            error={profileErrors.email}
            hint="É com este e-mail que você entra no painel."
          >
            <input
              name="email"
              type="email"
              defaultValue={email}
              className={inputClass}
              placeholder="voce@email.com"
            />
          </Field>
          <div className="border-t border-white/10 pt-4">
            <button type="submit" disabled={isPending} className={btn.primary}>
              {isPending ? "Salvando..." : "Salvar dados"}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Trocar senha">
        {usingSeedPassword ? (
          <p className="mb-4 border border-brand/40 bg-brand/10 px-3 py-2.5 text-sm text-cream">
            Você ainda está usando a senha padrão criada na instalação. Troque
            agora para proteger o painel.
          </p>
        ) : null}

        <form onSubmit={submitPassword} className="space-y-4" noValidate>
          <Field label="Senha atual" required error={passwordErrors.currentPassword}>
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className={inputClass}
              placeholder="••••••••"
            />
          </Field>
          <Field
            label="Nova senha"
            required
            error={passwordErrors.newPassword}
            hint="Mínimo de 8 caracteres."
          >
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              placeholder="••••••••"
            />
          </Field>
          <Field
            label="Confirmar nova senha"
            required
            error={passwordErrors.confirmPassword}
          >
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              placeholder="••••••••"
            />
          </Field>
          <div className="border-t border-white/10 pt-4">
            <button type="submit" disabled={isPending} className={btn.primary}>
              {isPending ? "Alterando..." : "Alterar senha"}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
