"use client";

import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import { Card, Field, btn, inputClass } from "@/components/admin/ui";
import {
  FAQ_CATEGORIES,
  isFaqAnswerReady,
  type FaqCategory,
  type FaqItem,
} from "@/lib/faq";
import type { SiteContent } from "@/lib/site-content";
import { type ConditionItem } from "@/lib/vehicle-conditions";

const FAQ_CATEGORY_OPTIONS = FAQ_CATEGORIES.filter(
  (item): item is { id: FaqCategory; label: string } => item.id !== "todas",
);

const textareaClass = `${inputClass} min-h-[96px] resize-y`;

export function SiteContentEditor({
  initial,
  errors = {},
}: {
  initial: SiteContent;
  errors?: Record<string, string>;
}) {
  const [faqItems, setFaqItems] = useState<FaqItem[]>(() =>
    initial.faqItems.map((item) => ({ ...item })),
  );
  const [conditionItems, setConditionItems] = useState<ConditionItem[]>(() =>
    initial.conditions.items.map((item) => ({ ...item })),
  );
  const [founderPhotoUrl, setFounderPhotoUrl] = useState(
    initial.founderPhotoUrl ?? "",
  );
  const [uploadingFounder, setUploadingFounder] = useState(false);

  async function uploadFounderPhoto(file: File | undefined) {
    if (!file) return;
    setUploadingFounder(true);
    try {
      const { uploadImageDirect } = await import("@/lib/upload-image-direct");
      const photo = await uploadImageDirect(file);
      setFounderPhotoUrl(photo.url);
      toast.success("Foto do Elias enviada. Clique em salvar.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro de conexão no upload.",
      );
    } finally {
      setUploadingFounder(false);
    }
  }

  return (
    <>
      <input type="hidden" name="faqJson" value={JSON.stringify(faqItems)} />
      <input
        type="hidden"
        name="conditionsJson"
        value={JSON.stringify(conditionItems)}
      />
      <input type="hidden" name="founderPhotoUrl" value={founderPhotoUrl} />

      <Card title="Foto do Elias na página Sobre">
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Use a foto original dele, com o fundo já removido. O site não gera
          retrato — só exibe o arquivo que você enviar.
        </p>
        {founderPhotoUrl ? (
          <div className="relative mb-4 h-64 w-full max-w-xs overflow-hidden border border-white/10 bg-black">
            <Image
              src={founderPhotoUrl}
              alt="Pré-visualização da foto do Elias"
              fill
              className="object-contain object-bottom"
              sizes="320px"
              unoptimized={/^https?:\/\//i.test(founderPhotoUrl)}
            />
          </div>
        ) : (
          <p className="mb-4 text-sm text-cream/80">
            Nenhuma foto no site agora. A biografia continua visível sem
            retrato.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${btn.outline} cursor-pointer`}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={uploadingFounder}
              onChange={(event) => {
                void uploadFounderPhoto(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            {uploadingFounder ? "Enviando…" : "Enviar foto original"}
          </label>
          {founderPhotoUrl ? (
            <button
              type="button"
              className={btn.ghost}
              onClick={() => setFounderPhotoUrl("")}
            >
              Remover foto
            </button>
          ) : null}
        </div>
        {errors.founderPhotoUrl ? (
          <p className="mt-3 text-sm text-brand">{errors.founderPhotoUrl}</p>
        ) : null}
      </Card>

      <Card title="Google Meu Negócio">
        <p className="mb-4 text-sm leading-relaxed text-muted">
          O selo na home só aparece com nota, quantidade e o link do perfil. Sem
          isso, o site não inventa avaliação.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nota" hint="De 0 a 5. Ex.: 4,8" error={errors.googleRating}>
            <input
              name="googleRating"
              inputMode="decimal"
              defaultValue={
                initial.google.rating > 0 ? String(initial.google.rating) : ""
              }
              placeholder="4,8"
              className={inputClass}
              aria-invalid={Boolean(errors.googleRating)}
            />
          </Field>
          <Field label="Quantidade de avaliações">
            <input
              name="googleReviewCount"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              defaultValue={
                initial.google.reviewCount > 0 ? initial.google.reviewCount : ""
              }
              placeholder="127"
              className={inputClass}
            />
          </Field>
          <Field
            label="Link do perfil"
            hint="URL do Google Meu Negócio"
            error={errors.googleProfileUrl}
            className="sm:col-span-3"
          >
            <input
              name="googleProfileUrl"
              type="url"
              defaultValue={initial.google.profileUrl}
              placeholder="https://g.page/..."
              className={inputClass}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Dúvidas frequentes"
        action={
          <span className="text-xs text-muted">
            {faqItems.filter((item) => isFaqAnswerReady(item.answer)).length} no
            site
          </span>
        }
      >
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Respostas com a palavra PREENCHER ficam só no painel, fora do site.
          A home usa as 5 primeiras já prontas.
        </p>
        <div className="space-y-4">
          {faqItems.map((item, index) => (
            <div key={`${item.question}-${index}`} className="border border-white/10 p-3">
              <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
                <Field label="Categoria">
                  <select
                    value={item.category}
                    onChange={(event) =>
                      setFaqItems((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                category: event.target.value as FaqCategory,
                              }
                            : row,
                        ),
                      )
                    }
                    className={inputClass}
                  >
                    {FAQ_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pergunta">
                  <input
                    value={item.question}
                    onChange={(event) =>
                      setFaqItems((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, question: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className={inputClass}
                  />
                </Field>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      setFaqItems((current) =>
                        current.filter((_, rowIndex) => rowIndex !== index),
                      )
                    }
                    className={btn.ghost}
                  >
                    Remover
                  </button>
                </div>
              </div>
              <Field label="Resposta" className="mt-3">
                <textarea
                  value={item.answer}
                  onChange={(event) =>
                    setFaqItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, answer: event.target.value }
                          : row,
                      )
                    )
                  }
                  className={textareaClass}
                />
              </Field>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setFaqItems((current) => [
              ...current,
              { category: "compra", question: "", answer: "" },
            ])
          }
          className={`${btn.outline} mt-4`}
        >
          Adicionar dúvida
        </button>
      </Card>

      <Card title="Condições na ficha do veículo">
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Texto ao lado do WhatsApp no anúncio. Itens com PREENCHER não
          aparecem para o visitante.
        </p>
        <div className="grid gap-4">
          <Field label="Título">
            <input
              name="conditionsTitle"
              defaultValue={initial.conditions.title}
              className={inputClass}
            />
          </Field>
          <Field
            label="Introdução"
            hint="Opcional. Some do site se ainda tiver PREENCHER."
          >
            <textarea
              name="conditionsIntro"
              defaultValue={initial.conditions.intro}
              className={textareaClass}
            />
          </Field>
        </div>
        <div className="mt-4 space-y-3">
          {conditionItems.map((item, index) => (
            <div key={`${item.label}-${index}`} className="grid gap-3 sm:grid-cols-[12rem_1fr_auto]">
              <Field label="Item">
                <input
                  value={item.label}
                  onChange={(event) =>
                    setConditionItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, label: event.target.value }
                          : row,
                      )
                    )
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Texto">
                <input
                  value={item.text}
                  onChange={(event) =>
                    setConditionItems((current) =>
                      current.map((row, rowIndex) =>
                        rowIndex === index
                          ? { ...row, text: event.target.value }
                          : row,
                      )
                    )
                  }
                  className={inputClass}
                />
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() =>
                    setConditionItems((current) =>
                      current.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                  className={btn.ghost}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setConditionItems((current) => [
              ...current,
              { label: "", text: "" },
            ])
          }
          className={`${btn.outline} mt-4`}
        >
          Adicionar item
        </button>
      </Card>
    </>
  );
}
