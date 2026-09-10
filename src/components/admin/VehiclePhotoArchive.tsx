"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconDownload, IconImage } from "@/components/admin/icons";
import { Card, btn, iconTap } from "@/components/admin/ui";

export type ArchivePhotoItem = {
  id: string;
  url: string;
  thumbnailUrl?: string | null;
};

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

async function downloadFromApi(href: string, fallbackName: string) {
  const response = await fetch(href, { credentials: "same-origin" });
  if (!response.ok) {
    let message = "Não foi possível baixar.";
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // resposta binária ou vazia
    }
    throw new Error(message);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (fallbackName.endsWith(".zip") && (bytes[0] !== 0x50 || bytes[1] !== 0x4b)) {
    throw new Error("O arquivo baixado não é um ZIP válido. Tente de novo.");
  }
  const type = fallbackName.endsWith(".zip")
    ? "application/zip"
    : response.headers.get("content-type") || "application/octet-stream";
  const blob = new Blob([bytes], { type });
  const name = filenameFromDisposition(
    response.headers.get("content-disposition"),
    fallbackName,
  );
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
}

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
      await downloadFromApi(zipHref, "fotos.zip");
      toast.success(
        photos.length === 1
          ? "Foto baixada."
          : `${photos.length} fotos da galeria baixadas.`,
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
      await downloadFromApi(
        `/api/admin/veiculos/${vehicleId}/fotos/${photoId}`,
        `foto-${String(index + 1).padStart(2, "0")}.webp`,
      );
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
            {zipPending ? "Preparando…" : "Baixar todas"}
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
            As fotos do ZIP são as mesmas da galeria do site (WebP até 1280px),
            sem o recorte pequeno do card. Não são o arquivo original da câmera
            — o upload já redimensiona para caber no anúncio.
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
              : `Baixar ${photos.length} foto${photos.length === 1 ? "" : "s"} da galeria`}
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
                      className="h-full w-full object-cover"
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
                      className={iconTap}
                      title="Baixar esta foto da galeria"
                      aria-label={`Baixar foto ${index + 1} da galeria`}
                    >
                      <IconDownload className="h-4 w-4" />
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
