"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveVehicleVerifiedInfo } from "@/app/admin/veiculos/verified-actions";
import { useUnsavedChangesWarning } from "@/components/admin/useUnsavedChangesWarning";
import { Card, btn, inputClass } from "@/components/admin/ui";
import { adminMutation } from "@/lib/admin-mutation";
import {
  VERIFIED_PHOTOS_PER_TOPIC,
  VERIFIED_TEXT_MAX,
  VERIFIED_TOPICS,
  verifiedHeading,
  verifiedTopicLabel,
  type VerifiedItem,
  type VerifiedTopicKey,
} from "@/lib/vehicle-verified";

export type VerifiedPanelPhoto = {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
};

type TopicState = Record<VerifiedTopicKey, { text: string; photoIds: string[] }>;

function initialState(items: VerifiedItem[]): TopicState {
  const state = {} as TopicState;
  for (const topic of VERIFIED_TOPICS) {
    const item = items.find((entry) => entry.key === topic.key);
    state[topic.key] = {
      text: item?.text ?? "",
      photoIds: item?.photoIds ?? [],
    };
  }
  return state;
}

/**
 * Editor das informações verificadas do exemplar. Uma frase curta por ponto
 * e, se quiser, até duas fotos que o anúncio já tem. Ponto em branco não
 * aparece na ficha e nada é preenchido por conta própria.
 */
export function VehicleVerifiedPanel({
  vehicleId,
  isMoto,
  photos,
  items,
  unavailable,
}: {
  vehicleId: string;
  isMoto: boolean;
  photos: VerifiedPanelPhoto[];
  items: VerifiedItem[];
  /** Tabela ausente (SQL não rodou) ou erro de leitura: o editor fica travado. */
  unavailable?: "missing-table" | "error";
}) {
  const router = useRouter();
  const [state, setState] = useState<TopicState>(() => initialState(items));
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  useUnsavedChangesWarning(dirty);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (unavailable) {
    return (
      <Card title={verifiedHeading(isMoto)}>
        <p className="text-sm text-cream">
          {unavailable === "missing-table"
            ? "Falta criar a tabela no banco. Cole prisma/sql/vehicle-verified-info.sql no SQL Editor do Supabase e recarregue esta aba."
            : "Não foi possível ler as informações agora. Recarregue a página."}
        </p>
      </Card>
    );
  }

  const filled = VERIFIED_TOPICS.filter((topic) =>
    state[topic.key].text.trim(),
  ).length;

  function patch(key: VerifiedTopicKey, next: Partial<TopicState[VerifiedTopicKey]>) {
    setState((current) => ({ ...current, [key]: { ...current[key], ...next } }));
    setDirty(true);
  }

  function togglePhoto(key: VerifiedTopicKey, photoId: string) {
    const current = state[key].photoIds;
    if (current.includes(photoId)) {
      patch(key, { photoIds: current.filter((id) => id !== photoId) });
    } else if (current.length < VERIFIED_PHOTOS_PER_TOPIC) {
      patch(key, { photoIds: [...current, photoId] });
    }
  }

  async function save() {
    if (pending) return;
    const formData = new FormData();
    for (const topic of VERIFIED_TOPICS) {
      formData.set(`text:${topic.key}`, state[topic.key].text);
      for (const id of state[topic.key].photoIds) {
        formData.append(`photos:${topic.key}`, id);
      }
    }
    setPending(true);
    const result = await adminMutation(() =>
      saveVehicleVerifiedInfo(vehicleId, formData),
    );
    if (!mounted.current) return;
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setDirty(false);
    toast.success(result.message);
    router.refresh();
  }

  return (
    <Card title={verifiedHeading(isMoto)}>
      <p className="text-sm text-muted">
        Só o que você conferiu neste exemplar. Em branco, o ponto não aparece na
        ficha — nada é preenchido por conta própria. Carro vendido não mostra
        esta seção.
      </p>

      <div className="mt-4 space-y-5">
        {VERIFIED_TOPICS.map((topic) => {
          const topicState = state[topic.key];
          const label = verifiedTopicLabel(topic.key, isMoto);
          const textId = `verified-${topic.key}`;
          return (
            <div key={topic.key}>
              <label
                htmlFor={textId}
                className="font-display text-xs font-semibold uppercase tracking-wider text-cream"
              >
                {label}
              </label>
              <textarea
                id={textId}
                rows={2}
                maxLength={VERIFIED_TEXT_MAX}
                value={topicState.text}
                placeholder={topic.placeholder}
                onChange={(event) =>
                  patch(topic.key, { text: event.target.value })
                }
                className={`${inputClass} mt-1.5 resize-y`}
              />
              <div className="mt-1 flex justify-between gap-3 text-[11px] text-muted">
                <span>
                  {topicState.text.length}/{VERIFIED_TEXT_MAX}
                </span>
              </div>

              {photos.length > 0 && topicState.text.trim() ? (
                <details className="mt-1.5 border border-white/10 bg-asphalt/40">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs text-cream [&::-webkit-details-marker]:hidden">
                    <span>Fotos deste ponto (opcional)</span>
                    <span className="text-muted">
                      {topicState.photoIds.length}/{VERIFIED_PHOTOS_PER_TOPIC}
                    </span>
                  </summary>
                  <ul className="grid grid-cols-4 gap-1.5 p-2 sm:grid-cols-6">
                    {photos.map((photo, index) => {
                      const selected = topicState.photoIds.includes(photo.id);
                      const full =
                        !selected &&
                        topicState.photoIds.length >= VERIFIED_PHOTOS_PER_TOPIC;
                      return (
                        <li key={photo.id}>
                          <button
                            type="button"
                            aria-pressed={selected}
                            aria-label={`Foto ${index + 1}${selected ? " (marcada)" : ""}`}
                            disabled={full}
                            onClick={() => togglePhoto(topic.key, photo.id)}
                            className={`relative block aspect-[4/3] w-full overflow-hidden border-2 touch-manipulation disabled:opacity-40 ${
                              selected ? "border-brand" : "border-transparent"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- miniatura do admin, sem cota /_next/image */}
                            <img
                              src={photo.thumbnailUrl || photo.url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              draggable={false}
                              className="h-full w-full object-cover"
                            />
                            {selected ? (
                              <span className="absolute right-0.5 top-0.5 bg-brand px-1 font-display text-[10px] font-bold text-cream">
                                {topicState.photoIds.indexOf(photo.id) + 1}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={pending || !dirty}
          className={`${btn.primary} w-full sm:w-auto`}
        >
          {pending ? "Salvando…" : "Salvar"}
        </button>
        <span className="text-xs text-muted">
          {filled === 0
            ? "Nenhum ponto preenchido"
            : `${filled} de ${VERIFIED_TOPICS.length} pontos na ficha`}
        </span>
      </div>
    </Card>
  );
}
