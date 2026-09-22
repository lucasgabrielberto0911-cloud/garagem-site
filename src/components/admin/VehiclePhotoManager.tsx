"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { VehicleImage } from "@/components/VehicleImage";
import {
  IconArrowDown,
  IconArrowUp,
  IconDownload,
  IconGrip,
  IconImage,
  IconStar,
  IconTrash,
} from "@/components/admin/icons";
import { PlateBlurEditor } from "@/components/admin/PlateBlurEditor";
import { btn } from "@/components/admin/ui";
import type { NormalizedRect } from "@/lib/blur-rects";
import { downloadAttachment } from "@/lib/download-attachment";
import {
  adminStorageJpgPath,
  archivePhotoFilename,
} from "@/lib/photo-archive";
import {
  photoUploadProgressLabel,
  summarizePhotoUploads,
  type PhotoUploadJobState,
} from "@/lib/photo-upload-jobs";

type LocalPhotoJob = PhotoUploadJobState & { file: File };

export type PhotoItem = {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
};

const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif";

function isImageFile(file: File) {
  if (file.type) {
    const type = file.type.toLowerCase();
    if (
      type === "image/jpeg" ||
      type === "image/png" ||
      type === "image/webp" ||
      type === "image/gif" ||
      type === "image/heic" ||
      type === "image/heif"
    ) {
      return true;
    }
  }
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
}

export function createPhotoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function photosFromRecords(
  photos: Array<{
    url: string;
    thumbnailUrl?: string | null;
  }>,
): PhotoItem[] {
  return photos.map((photo) => ({
    id: createPhotoId(),
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl ?? null,
  }));
}

export function photosFromUrls(urls: string[]): PhotoItem[] {
  return urls.map((url) => ({
    id: createPhotoId(),
    url,
    thumbnailUrl: null,
  }));
}

/**
 * Upload por arrastar/clicar + reorganização das fotos por drag-and-drop
 * (setas e “capa” ficam como atalho no desktop/mobile).
 */
export function VehiclePhotoManager({
  photos,
  onChange,
  onUploadingChange,
  listing,
}: {
  photos: PhotoItem[];
  onChange: (
    next: PhotoItem[] | ((current: PhotoItem[]) => PhotoItem[]),
  ) => void;
  onUploadingChange?: (uploading: boolean) => void;
  listing?: { brand: string; model: string; year: number };
}) {
  const [jobs, setJobs] = useState<LocalPhotoJob[]>([]);
  const [blurring, setBlurring] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [blurredIds, setBlurredIds] = useState<Set<string>>(() => new Set());
  const [fileDragging, setFileDragging] = useState(false);
  const fileDragDepth = useRef(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);

  const summary = summarizePhotoUploads(jobs);
  const inFlight = summary.uploading > 0 || summary.queued > 0;
  const pendingSkeletons = summary.uploading + summary.queued;

  useEffect(() => {
    onUploadingChange?.(inFlight || blurring);
  }, [inFlight, blurring, onUploadingChange]);

  function patchJob(id: string, patch: Partial<LocalPhotoJob>) {
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  }

  async function runJobs(batch: LocalPhotoJob[]) {
    if (batch.length === 0) return;

    const uploaded: PhotoItem[] = [];
    try {
      const { uploadImageDirect } = await import("@/lib/upload-image-direct");

      for (const job of batch) {
        patchJob(job.id, { status: "uploading", error: undefined });
        try {
          const photo = await uploadImageDirect(job.file, { master: true });
          uploaded.push({
            id: createPhotoId(),
            url: photo.url,
            thumbnailUrl: photo.thumbnailUrl,
          });
          patchJob(job.id, { status: "done" });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : `Falha no upload de ${job.name}.`;
          patchJob(job.id, { status: "error", error: message });
          toast.error(message);
        }
      }

      if (uploaded.length > 0) {
        onChange((current) => [...current, ...uploaded]);
        toast.success(`${uploaded.length} foto(s) enviada(s).`);
      } else if (batch.length > 0) {
        toast.error("Nenhuma foto foi enviada.");
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro inesperado no upload.",
      );
      setJobs((current) =>
        current.map((job) =>
          batch.some((item) => item.id === job.id) &&
          job.status !== "done"
            ? {
                ...job,
                status: "error" as const,
                error:
                  error instanceof Error
                    ? error.message
                    : "Erro inesperado no upload.",
              }
            : job,
        ),
      );
    }
  }

  async function downloadPhoto(photo: PhotoItem, index: number) {
    if (downloadId || !photo.url) return;
    const filename = archivePhotoFilename({
      brand: listing?.brand ?? "",
      model: listing?.model ?? "",
      year: listing?.year && listing.year > 1900 ? listing.year : new Date().getFullYear(),
      index: index + 1,
      url: photo.url,
    });
    setDownloadId(photo.id);
    try {
      await downloadAttachment(adminStorageJpgPath(photo.url, filename), filename);
      toast.success("JPG em alta baixado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no download.");
    } finally {
      setDownloadId(null);
    }
  }

  async function uploadFiles(files: FileList | File[] | null) {
    const list = (files ? Array.from(files) : []).filter(isImageFile);
    if (list.length === 0) {
      if (files && files.length > 0) {
        toast.error("Envie apenas imagens JPG, PNG, WEBP, GIF ou HEIC.");
      }
      return;
    }

    const nextJobs: LocalPhotoJob[] = list.map((file) => ({
      id: createPhotoId(),
      name: file.name,
      status: "queued",
      file,
    }));
    setJobs(nextJobs);
    await runJobs(nextJobs);
  }

  async function retryJobs(failed: LocalPhotoJob[]) {
    if (failed.length === 0 || inFlight) return;
    setJobs((current) =>
      current.map((job) =>
        failed.some((item) => item.id === job.id)
          ? { ...job, status: "queued", error: undefined }
          : job,
      ),
    );
    await runJobs(failed.map((job) => ({ ...job, status: "queued", error: undefined })));
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [picked] = next.splice(from, 1);
    next.splice(to, 0, picked);
    onChange(next);
  }

  function movePhoto(index: number, direction: -1 | 1) {
    reorder(index, index + direction);
  }

  function makeCover(index: number) {
    if (index === 0) return;
    reorder(index, 0);
  }

  function removePhoto(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  function confirmRemovePhoto() {
    if (removeIndex == null) return;
    removePhoto(removeIndex);
    setRemoveIndex(null);
  }

  const editingPhoto = photos.find((photo) => photo.id === editingId) ?? null;

  async function applyPlateBlur(rects: NormalizedRect[]) {
    if (!editingPhoto || blurring) return;
    const photoId = editingPhoto.id;
    const currentUrl = editingPhoto.url;
    setBlurring(true);
    try {
      const response = await fetch("/api/upload/blur-region", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl, rects }),
      });
      const data = (await response.json()) as {
        url?: string;
        thumbnailUrl?: string | null;
        error?: string;
      };
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Não foi possível borrar a região.");
      }
      onChange((current) =>
        current.map((photo) =>
          photo.id === photoId
            ? {
                ...photo,
                url: data.url as string,
                thumbnailUrl: data.thumbnailUrl ?? photo.thumbnailUrl,
              }
            : photo,
        ),
      );
      setBlurredIds((current) => {
        const next = new Set(current);
        next.add(photoId);
        return next;
      });
      toast.success("Região borracha. Salve o anúncio para publicar.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível borrar a região.",
      );
    } finally {
      setBlurring(false);
    }
  }

  function hasFiles(event: React.DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  return (
    <div
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        fileDragDepth.current += 1;
        setFileDragging(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        fileDragDepth.current = Math.max(0, fileDragDepth.current - 1);
        if (fileDragDepth.current === 0) setFileDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        fileDragDepth.current = 0;
        setFileDragging(false);
        void uploadFiles(event.dataTransfer.files);
      }}
    >
      <div
        className={`relative border border-dashed px-6 py-8 text-center transition ${
          fileDragging
            ? "border-brand bg-brand/10"
            : "border-white/15 hover:border-brand/50"
        }`}
      >
        <label className="flex cursor-pointer flex-col items-center justify-center">
          <IconImage className="h-8 w-8 text-white/25" />
          <p className="mt-3 text-sm text-cream">
            {inFlight
              ? photoUploadProgressLabel(jobs)
              : fileDragging
                ? "Solte as fotos para enviar"
                : "Arraste as fotos aqui ou clique para escolher"}
          </p>
          <p className="mt-1 text-xs text-muted">
            JPG, PNG, WEBP ou GIF · HEIC: exporte como JPG no iPhone. A placa
            se borra depois, no retângulo que você marcar.
          </p>
          <p className="mt-2 text-[11px] text-muted/80">
            Espere o envio ou o borrão terminar antes de salvar o anúncio.
          </p>
          <input
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            disabled={inFlight}
            onChange={(event) => {
              void uploadFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {jobs.length > 0 ? (
        <div className="mt-3 space-y-2" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-cream">
              {photoUploadProgressLabel(jobs)}
            </p>
            {summary.hasFailures && !inFlight ? (
              <button
                type="button"
                onClick={() =>
                  void retryJobs(jobs.filter((job) => job.status === "error"))
                }
                className={btn.outline}
              >
                Tentar de novo
              </button>
            ) : null}
          </div>
          <div className="h-1.5 overflow-hidden bg-white/10">
            <div
              className="h-full bg-brand transition-[width]"
              style={{
                width: `${Math.max(summary.percent, inFlight ? 8 : 0)}%`,
              }}
            />
          </div>
          {summary.hasFailures ? (
            <ul className="space-y-1 text-xs text-muted">
              {summary.failed.map((job) => (
                <li
                  key={job.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate text-brand">
                    {job.name}
                    {job.error ? ` — ${job.error}` : ""}
                  </span>
                  {!inFlight ? (
                    <button
                      type="button"
                      onClick={() =>
                        void retryJobs(
                          jobs.filter((item) => item.id === job.id),
                        )
                      }
                      className="shrink-0 text-[11px] uppercase tracking-wider text-cream underline-offset-2 hover:underline"
                    >
                      Reenviar
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {pendingSkeletons > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: pendingSkeletons }).map((_, index) => (
            <li key={index} className="skeleton aspect-[4/3]" />
          ))}
        </ul>
      ) : null}

      {photos.length === 0 && !inFlight ? (
        <p className="mt-4 text-sm text-muted">
          Nenhuma foto adicionada. Anúncios com fotos recebem muito mais
          contato.
        </p>
      ) : photos.length > 0 ? (
        <>
          <p className="mt-4 text-xs text-muted">
            Arraste as fotos para reorganizar. A primeira é a capa do anúncio.
            Em <strong>Borrar placa</strong>, marque o retângulo e salve o
            anúncio. <strong>Alta</strong> baixa o JPG na melhor qualidade
            guardada: fotos novas usam o original privado (até 3840px); o
            estoque antigo usa a galeria inteira, sem reduzir de novo. O
            visitante só baixa a versão leve, e a página continua em WebP.
            Segurar a foto também baixa o JPG em alta.
          </p>
          {blurredIds.size > 0 && !blurring ? (
            <p className="mt-3 border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 text-sm text-cream">
              Região borracha. <strong>Salve o anúncio</strong> para publicar
              a foto nova no site.
            </p>
          ) : null}
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => {
              const isDragging = dragIndex === index;
              const isOver = overIndex === index && dragIndex !== index;
              return (
                <li
                  key={photo.id}
                  draggable
                  onContextMenu={(event) => {
                    const target = event.target as HTMLElement | null;
                    if (target?.closest("button, a")) return;
                    event.preventDefault();
                    void downloadPhoto(photo, index);
                  }}
                  onDragStart={(event) => {
                    // Não inicia reorder se estiver arrastando arquivos do SO.
                    if (hasFiles(event)) return;
                    setDragIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(index));
                    event.dataTransfer.setData(
                      "application/x-garagem-photo",
                      photo.id,
                    );
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  onDragOver={(event) => {
                    if (hasFiles(event)) return;
                    if (dragIndex === null) return;
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "move";
                    if (overIndex !== index) setOverIndex(index);
                  }}
                  onDragLeave={() => {
                    if (overIndex === index) setOverIndex(null);
                  }}
                  onDrop={(event) => {
                    if (hasFiles(event)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const from =
                      dragIndex ??
                      Number(event.dataTransfer.getData("text/plain"));
                    if (Number.isFinite(from)) reorder(from, index);
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className={`group relative aspect-[4/3] cursor-grab overflow-hidden border bg-asphalt active:cursor-grabbing ${
                    isDragging
                      ? "border-brand opacity-50"
                      : isOver
                        ? "border-brand ring-2 ring-brand/40"
                        : "border-white/10"
                  }`}
                >
                  <VehicleImage
                    src={photo.url}
                    alt={`Foto ${index + 1} do veículo`}
                    fill
                    className="pointer-events-none object-cover [-webkit-touch-callout:none]"
                    sizes="240px"
                  />

                  <span className="absolute left-1.5 top-1.5 flex items-center gap-1 bg-asphalt/80 px-1.5 py-1 text-cream backdrop-blur">
                    <IconGrip className="h-3.5 w-3.5 text-muted" />
                    <span className="font-display text-[10px] font-semibold tabular-nums">
                      {index + 1}
                    </span>
                  </span>

                  {index === 0 ? (
                    <span className="absolute right-1.5 top-1.5 bg-brand px-2 py-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-cream">
                      Capa
                    </span>
                  ) : null}

                  <div className="absolute inset-x-1.5 bottom-14 flex items-stretch gap-1">
                    <button
                      type="button"
                      disabled={blurring || inFlight}
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setEditingId(photo.id);
                      }}
                      className="min-h-11 flex-1 bg-asphalt/90 px-1.5 text-center font-display text-[10px] font-semibold uppercase tracking-wider text-cream touch-manipulation disabled:opacity-80"
                      title="Marcar a placa com um retângulo e borrar só essa área"
                    >
                      {blurring && editingId === photo.id
                        ? "Borrando…"
                        : blurredIds.has(photo.id)
                          ? "Borrar de novo"
                          : "Borrar placa"}
                    </button>
                    <button
                      type="button"
                      disabled={downloadId === photo.id}
                      onMouseDown={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void downloadPhoto(photo, index);
                      }}
                      className="inline-flex h-11 shrink-0 items-center gap-1 bg-asphalt/90 px-2 text-cream touch-manipulation disabled:opacity-60"
                      title="Baixar JPG em alta qualidade"
                      aria-label={`Baixar foto ${index + 1} em JPG de alta qualidade`}
                    >
                      <IconDownload className="h-4 w-4" />
                      <span className="font-display text-[10px] font-semibold uppercase tracking-wider">
                        {downloadId === photo.id ? "…" : "Alta"}
                      </span>
                    </button>
                  </div>

                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-asphalt/85 px-1.5 py-1.5 backdrop-blur">
                    <div className="flex gap-0.5">
                      <PhotoAction
                        label="Mover para trás"
                        disabled={index === 0}
                        onClick={() => movePhoto(index, -1)}
                      >
                        <IconArrowUp className="h-4 w-4 -rotate-90" />
                      </PhotoAction>
                      <PhotoAction
                        label="Mover para frente"
                        disabled={index === photos.length - 1}
                        onClick={() => movePhoto(index, 1)}
                      >
                        <IconArrowDown className="h-4 w-4 -rotate-90" />
                      </PhotoAction>
                      <PhotoAction
                        label="Definir como capa"
                        disabled={index === 0}
                        onClick={() => makeCover(index)}
                      >
                        <IconStar className="h-4 w-4" />
                      </PhotoAction>
                    </div>
                    <PhotoAction
                      label="Remover foto"
                      danger
                      onClick={() => setRemoveIndex(index)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </PhotoAction>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <PlateBlurEditor
        open={editingPhoto !== null}
        imageUrl={editingPhoto?.url ?? ""}
        applying={blurring}
        blurred={editingPhoto ? blurredIds.has(editingPhoto.id) : false}
        onClose={() => {
          if (!blurring) setEditingId(null);
        }}
        onApply={(rects) => {
          void applyPlateBlur(rects);
        }}
      />

      <ConfirmDialog
        open={removeIndex !== null}
        title="Remover foto"
        description="Tirar esta foto do anúncio? Ela some da galeria quando você salvar."
        confirmLabel="Remover foto"
        danger
        onCancel={() => setRemoveIndex(null)}
        onConfirm={confirmRemovePhoto}
      />
    </div>
  );
}

function PhotoAction({
  children,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      className={`inline-flex h-11 w-11 items-center justify-center transition disabled:opacity-30 touch-manipulation ${
        danger
          ? "text-brand hover:bg-brand/20 hover:text-cream"
          : "text-cream/80 hover:bg-white/10 hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}
