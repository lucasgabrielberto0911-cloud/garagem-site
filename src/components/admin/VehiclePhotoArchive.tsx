"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconDownload, IconImage } from "@/components/admin/icons";
import { Card, btn } from "@/components/admin/ui";
import { downloadAttachment } from "@/lib/download-attachment";

export type ArchivePhotoItem = {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
};

export function VehiclePhotoArchive({
  vehicleId,
  photos,
}: {
  vehicleId: string;
  photos: ArchivePhotoItem[];
}) {
  const [zipPending, setZipPending] = useState(false);
  const [photoPending, setPhotoPending] = useState<string | null>(null);
  const zipHref = `/api/admin/veiculos/${vehicleId}/fotos`;

  async function handleZip() {
    if (zipPending || photos.length === 0) return;
    setZipPending(true);
    try {
      await downloadAttachment(zipHref, "fotos.zip");
      toast.success(
        photos.length === 1
          ? "JPG em alta baixado."
          : `${photos.length} fotos em alta baixadas.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no download.");
    } finally {
      setZipPending(false);
    }
  }

  async function handleOne(photoId: string, index: number) {
    if (photoPending) return;
    setPhotoPending(photoId);
    try {
      await downloadAttachment(
        `/api/admin/veiculos/${vehicleId}/fotos/${photoId}`,
        `foto-${String(index + 1).padStart(2, "0")}.jpg`,
      );
      toast.success("JPG em alta baixado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no download.");
    } finally {
      setPhotoPending(null);
    }
  }

  return (
    <Card
      title={photos.length > 0 ? `Acervo de fotos · ${photos.length}` : "Acervo de fotos"}
      action={
        photos.length > 0 ? (
          <button
            type="button"
            onClick={() => void handleZip()}
            disabled={zipPending}
            className={btn.ghost}
          >
            <IconDownload className="h-4 w-4" />
            {zipPending ? "Preparando…" : "Baixar todas em alta"}
          </button>
        ) : null
      }
    >
      {photos.length === 0 ? (
        <p className="text-sm text-muted">
          Este anúncio ainda não tem fotos. Envie na aba Anúncio para usar o
          site como acervo.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">
            O site público mostra as fotos em WebP e não oferece download.
            Aqui, Alta e Baixar todas usam a melhor foto guardada
            — master privado até 3840px nas fotos novas; no estoque antigo, a
            galeria inteira em JPEG 93, sem reduzir de novo.
          </p>

          <button
            type="button"
            onClick={() => void handleZip()}
            disabled={zipPending}
            className={`${btn.primary} w-full sm:w-auto`}
          >
            <IconDownload className="h-4 w-4" />
            {zipPending
              ? "Montando ZIP…"
              : `Baixar ${photos.length} foto${photos.length === 1 ? "" : "s"} em alta`}
          </button>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => {
              const preview = photo.thumbnailUrl || photo.url;
              const busy = photoPending === photo.id;
              return (
                <li
                  key={photo.id}
                  className="overflow-hidden border border-white/10 bg-asphalt"
                >
                  <div className="relative aspect-[4/3] bg-ink">
                    {/* eslint-disable-next-line @next/next/no-img-element -- acervo admin, sem cota /_next/image */}
                    <img
                      src={preview}
                      alt={`Foto ${index + 1}`}
                      draggable={false}
                      className="h-full w-full object-cover [-webkit-touch-callout:none]"
                      onContextMenu={(event) => {
                        event.preventDefault();
                        void handleOne(photo.id, index);
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted">
                      <IconImage className="h-3.5 w-3.5" />
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleOne(photo.id, index)}
                      disabled={busy || zipPending}
                      className="inline-flex h-11 items-center gap-1 px-1.5 text-muted transition touch-manipulation hover:text-cream disabled:opacity-60"
                      title="Baixar JPG em alta qualidade"
                      aria-label={`Baixar foto ${index + 1} em JPG de alta qualidade`}
                    >
                      <IconDownload className="h-4 w-4" />
                      <span className="font-display text-[10px] font-semibold uppercase tracking-wider">
                        {busy ? "…" : "Alta"}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
