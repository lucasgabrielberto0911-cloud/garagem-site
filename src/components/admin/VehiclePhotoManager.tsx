"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { VehicleImage } from "@/components/VehicleImage";
import {
  IconArrowDown,
  IconArrowUp,
  IconGrip,
  IconImage,
  IconStar,
  IconTrash,
} from "@/components/admin/icons";

export type PhotoItem = { id: string; url: string };

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function isImageFile(file: File) {
  if (file.type && ACCEPT.split(",").includes(file.type)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

export function createPhotoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `photo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function photosFromUrls(urls: string[]): PhotoItem[] {
  return urls.map((url) => ({ id: createPhotoId(), url }));
}

/**
 * Upload por arrastar/clicar + reorganização das fotos por drag-and-drop
 * (setas e “capa” ficam como atalho no desktop/mobile).
 */
export function VehiclePhotoManager({
  photos,
  onChange,
}: {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
}) {
  const [uploading, setUploading] = useState(0);
  const [fileDragging, setFileDragging] = useState(false);
  const fileDragDepth = useRef(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  async function uploadFiles(files: FileList | File[] | null) {
    const list = (files ? Array.from(files) : []).filter(isImageFile);
    if (list.length === 0) {
      if (files && files.length > 0) {
        toast.error("Envie apenas imagens JPG, PNG, WEBP ou GIF.");
      }
      return;
    }

    setUploading(list.length);
    try {
      const formData = new FormData();
      list.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Falha no upload.");
        return;
      }

      const urls = (data.urls as string[]) ?? [];
      onChange([
        ...photos,
        ...urls.map((url) => ({ id: createPhotoId(), url })),
      ]);
      toast.success(`${urls.length} foto(s) enviada(s).`);
    } catch {
      toast.error("Erro de conexão no upload.");
    } finally {
      setUploading(0);
    }
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
            {uploading > 0
              ? `Enviando ${uploading} foto(s)...`
              : fileDragging
                ? "Solte as fotos para enviar"
                : "Arraste as fotos aqui ou clique para escolher"}
          </p>
          <p className="mt-1 text-xs text-muted">
            JPG, PNG, WEBP ou GIF · várias de uma vez
          </p>
          <input
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            disabled={uploading > 0}
            onChange={(event) => {
              void uploadFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>

      {uploading > 0 ? (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: uploading }).map((_, index) => (
            <li key={index} className="skeleton aspect-[4/3]" />
          ))}
        </ul>
      ) : null}

      {photos.length === 0 && uploading === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Nenhuma foto adicionada. Anúncios com fotos recebem muito mais
          contato.
        </p>
      ) : photos.length > 0 ? (
        <>
          <p className="mt-4 text-xs text-muted">
            Arraste as fotos para reorganizar. A primeira é a capa do anúncio.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => {
              const isDragging = dragIndex === index;
              const isOver = overIndex === index && dragIndex !== index;
              return (
                <li
                  key={photo.id}
                  draggable
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
                    className="pointer-events-none object-cover"
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

                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-asphalt/85 px-1.5 py-1.5 backdrop-blur">
                    <div className="flex gap-0.5">
                      <PhotoAction
                        label="Mover para trás"
                        disabled={index === 0}
                        onClick={() => movePhoto(index, -1)}
                      >
                        <IconArrowUp className="h-3.5 w-3.5 -rotate-90" />
                      </PhotoAction>
                      <PhotoAction
                        label="Mover para frente"
                        disabled={index === photos.length - 1}
                        onClick={() => movePhoto(index, 1)}
                      >
                        <IconArrowDown className="h-3.5 w-3.5 -rotate-90" />
                      </PhotoAction>
                      <PhotoAction
                        label="Definir como capa"
                        disabled={index === 0}
                        onClick={() => makeCover(index)}
                      >
                        <IconStar className="h-3.5 w-3.5" />
                      </PhotoAction>
                    </div>
                    <PhotoAction
                      label="Remover foto"
                      danger
                      onClick={() => removePhoto(index)}
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </PhotoAction>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
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
      className={`inline-flex h-7 w-7 items-center justify-center transition disabled:opacity-30 ${
        danger
          ? "text-brand hover:bg-brand/20 hover:text-cream"
          : "text-cream/80 hover:bg-white/10 hover:text-cream"
      }`}
    >
      {children}
    </button>
  );
}
