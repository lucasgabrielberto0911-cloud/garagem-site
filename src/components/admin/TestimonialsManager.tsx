"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { Testimonial } from "@prisma/client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  IconEye,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@/components/admin/icons";
import { IconQuote } from "@/components/site/icons";
import {
  Badge,
  Card,
  EmptyState,
  Field,
  btn,
  inputClass,
} from "@/components/admin/ui";
import {
  deleteTestimonial,
  saveTestimonial,
  setTestimonialPublished,
} from "@/app/admin/depoimentos/actions";

const emptyForm = {
  id: "",
  name: "",
  city: "",
  message: "",
  photoUrl: "",
  order: "0",
  published: true,
};

export function TestimonialsManager({ items }: { items: Testimonial[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Testimonial | null>(null);
  const [uploading, setUploading] = useState(false);

  function openCreate() {
    setErrors({});
    setForm({ ...emptyForm });
  }

  function openEdit(item: Testimonial) {
    setErrors({});
    setForm({
      id: item.id,
      name: item.name,
      city: item.city ?? "",
      message: item.message,
      photoUrl: item.photoUrl ?? "",
      order: String(item.order),
      published: item.published,
    });
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { uploadImageDirect } = await import("@/lib/upload-image-direct");
      const photoUrl = await uploadImageDirect(file);
      setForm((current) =>
        current ? { ...current, photoUrl } : current,
      );
      toast.success("Foto enviada.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro de conexão no upload.",
      );
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveTestimonial(formData);
      setErrors(result.fieldErrors ?? {});
      if (result.ok) {
        toast.success(result.message);
        setForm(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function togglePublished(item: Testimonial) {
    startTransition(async () => {
      const result = await setTestimonialPublished(item.id, !item.published);
      toast.success(result.message);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const result = await deleteTestimonial(target.id);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
      setDeleteTarget(null);
    });
  }

  return (
    <div className="space-y-5">
      {form ? (
        <Card title={form.id ? "Editar depoimento" : "Novo depoimento"}>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <input type="hidden" name="id" value={form.id} />
            <input type="hidden" name="photoUrl" value={form.photoUrl} />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do cliente" required error={errors.name}>
                <input
                  name="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                  placeholder="Ex.: Marcos A."
                  className={inputClass}
                />
              </Field>
              <Field label="Cidade">
                <input
                  name="city"
                  value={form.city}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, city: event.target.value } : current,
                    )
                  }
                  placeholder="Ex.: Vitória - ES"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field
              label="Depoimento"
              required
              error={errors.message}
              hint="Use as palavras do cliente. Publique apenas avaliações reais."
            >
              <textarea
                name="message"
                rows={4}
                value={form.message}
                onChange={(event) =>
                  setForm((current) =>
                    current ? { ...current, message: event.target.value } : current,
                  )
                }
                className={`${inputClass} resize-y`}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Ordem" hint="Menor número aparece primeiro.">
                <input
                  name="order"
                  type="number"
                  value={form.order}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, order: event.target.value } : current,
                    )
                  }
                  className={inputClass}
                />
              </Field>

              <Field label="Foto (opcional)">
                <label className="flex cursor-pointer items-center justify-center border border-white/10 bg-ink px-3 py-2.5 text-xs text-cream transition hover:border-brand/50">
                  {uploading
                    ? "Enviando..."
                    : form.photoUrl
                      ? "Trocar foto"
                      : "Escolher foto"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(event) => {
                      void uploadPhoto(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </Field>

              <div className="flex items-end">
                <label className="flex w-full cursor-pointer items-center gap-2.5 border border-white/10 bg-ink px-3 py-2.5 text-sm text-cream transition hover:border-brand/50">
                  <input
                    type="checkbox"
                    name="published"
                    checked={form.published}
                    onChange={(event) =>
                      setForm((current) =>
                        current
                          ? { ...current, published: event.target.checked }
                          : current,
                      )
                    }
                    className="h-4 w-4 accent-brand"
                  />
                  Publicado no site
                </label>
              </div>
            </div>

            {form.photoUrl ? (
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-full bg-asphalt">
                  <Image
                    src={form.photoUrl}
                    alt="Foto do cliente"
                    fill
                    sizes="48px"
                    unoptimized
                    className="object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) =>
                      current ? { ...current, photoUrl: "" } : current,
                    )
                  }
                  className="text-xs text-brand underline-offset-4 hover:underline"
                >
                  Remover foto
                </button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
              <button type="submit" disabled={isPending} className={btn.primary}>
                {isPending ? "Salvando..." : form.id ? "Salvar" : "Publicar"}
              </button>
              <button
                type="button"
                onClick={() => setForm(null)}
                className={btn.outline}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Card>
      ) : (
        <button type="button" onClick={openCreate} className={btn.primary}>
          <IconPlus className="h-4 w-4" />
          Novo depoimento
        </button>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={<IconQuote className="h-12 w-12" />}
          title="Nenhum depoimento cadastrado"
          description="Enquanto não houver depoimentos, a home mostra um aviso de 'em breve'. Publique avaliações reais de clientes."
          action={
            <button type="button" onClick={openCreate} className={btn.primary}>
              <IconPlus className="h-4 w-4" />
              Cadastrar depoimento
            </button>
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="border border-white/10 bg-ink/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-brand/15">
                    {item.photoUrl ? (
                      <Image
                        src={item.photoUrl}
                        alt={item.name}
                        fill
                        sizes="40px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-display text-sm font-semibold text-brand">
                        {item.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold text-cream">
                      {item.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {item.city ?? "Sem cidade"} · ordem {item.order}
                    </p>
                  </div>
                </div>
                <Badge tone={item.published ? "success" : "neutral"}>
                  {item.published ? "No site" : "Oculto"}
                </Badge>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-muted">
                {item.message}
              </p>

              <div className="mt-3 flex items-center gap-1 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => togglePublished(item)}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-2 py-1.5 text-xs text-muted transition hover:text-cream disabled:opacity-50"
                >
                  <IconEye className="h-4 w-4" />
                  {item.published ? "Ocultar" : "Publicar"}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="ml-auto p-2 text-muted transition hover:text-cream"
                  aria-label="Editar depoimento"
                  title="Editar"
                >
                  <IconPencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  className="p-2 text-brand transition hover:text-cream"
                  aria-label="Excluir depoimento"
                  title="Excluir"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Excluir depoimento"
        description={
          deleteTarget
            ? `Excluir o depoimento de ${deleteTarget.name}? Esta ação não pode ser desfeita.`
            : undefined
        }
        confirmLabel="Excluir"
        danger
        loading={isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
