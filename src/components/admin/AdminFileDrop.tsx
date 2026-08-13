"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { IconAttach, IconCheck } from "@/components/admin/icons";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

function isAllowedFile(file: File) {
  const type = (file.type || "").toLowerCase();
  if (
    type === "application/pdf" ||
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/png" ||
    type === "image/webp"
  ) {
    return true;
  }
  return /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
}

function hasFiles(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function AdminFileDrop({
  label,
  hint,
  required = false,
  fileName,
  uploading = false,
  disabled = false,
  onFile,
  onClear,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  fileName?: string | null;
  uploading?: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
  onClear?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const busy = uploading || disabled;

  function pickFromList(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;

    const allowed = list.filter(isAllowedFile);
    if (allowed.length === 0) {
      toast.error("Use PDF, JPG, PNG ou WEBP.");
      return;
    }
    if (list.length > 1) {
      toast.message("Um arquivo por vez — usando o primeiro.");
    }
    onFile(allowed[0]);
  }

  return (
    <div>
      <p className="mb-1.5 text-[11px] uppercase tracking-wider text-muted">
        {label}
        {required ? <span className="ml-1 text-brand">*</span> : null}
      </p>
      <div
        onDragEnter={(event) => {
          if (busy || !hasFiles(event)) return;
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (busy || !hasFiles(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={(event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          event.stopPropagation();
          dragDepth.current = 0;
          setDragging(false);
          if (busy) return;
          pickFromList(event.dataTransfer.files);
        }}
        className={`border border-dashed text-center transition ${
          dragging
            ? "border-brand bg-brand/10"
            : fileName
              ? "border-emerald-400/30 bg-emerald-400/5"
              : "border-white/15 hover:border-brand/50"
        }`}
      >
        <label
          className={`flex cursor-pointer flex-col items-center justify-center px-4 py-5 ${
            busy ? "pointer-events-none opacity-70" : ""
          }`}
        >
          {fileName && !uploading ? (
            <IconCheck className="h-7 w-7 text-emerald-300" />
          ) : (
            <IconAttach className="h-7 w-7 text-white/25" />
          )}
          <p className="mt-2 max-w-full truncate px-2 text-sm text-cream" title={fileName || undefined}>
            {uploading
              ? "Enviando arquivo…"
              : dragging
                ? "Solte para anexar"
                : fileName
                  ? fileName
                  : "Arraste o arquivo aqui ou clique para escolher"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {hint ?? "PDF, JPG, PNG ou WEBP"}
          </p>
          <input
            type="file"
            accept={ACCEPT}
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              pickFromList(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
        {fileName && onClear && !uploading ? (
          <div className="pb-3">
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-muted transition hover:text-cream"
            >
              Remover
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
