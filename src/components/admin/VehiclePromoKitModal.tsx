"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PROMO_ART_ORDER,
  PROMO_ART_SPECS,
  PROMO_LOGO_SRC,
  buildInstagramPromo,
  buildPromoFileName,
  buildPromoZipFileName,
  buildWhatsAppPromo,
  buildZipArchive,
  renderPromoArt,
  resolvePromoPhotoSrc,
  sanitizePromoText,
  type PromoArtKind,
  type PromoVehicle,
} from "@/lib/vehicle-promo-kit";
import { IconCopy } from "@/components/admin/icons";

let barlowFontLoadPromise: Promise<void> | null = null;

function ensurePromoCanvasFonts(): Promise<void> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve();
  }
  if (!barlowFontLoadPromise) {
    barlowFontLoadPromise = (async () => {
      try {
        if (typeof FontFace !== "undefined" && document.fonts) {
          const face = new FontFace(
            "Barlow Condensed",
            "url(/fonts/BarlowCondensed-ExtraBoldItalic.ttf)",
            { style: "italic", weight: "800" },
          );
          const loaded = await face.load();
          document.fonts.add(loaded);
        }
        await document.fonts?.ready;
      } catch {
        // Segue com fallback seguro se a fonte falhar
      }
    })();
  }
  return barlowFontLoadPromise;
}

function loadSameOriginImage(
  src: string,
): Promise<HTMLImageElement | undefined> {
  if (!src || typeof Image === "undefined") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function VehiclePromoKitModal({
  vehicle,
  open,
  onClose,
}: {
  vehicle: PromoVehicle | null;
  open: boolean;
  onClose: () => void;
}) {
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState(0);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const feedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const storyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const coverCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const photoCount = vehicle?.photos?.length ?? 0;
  const activePhotoIdx =
    photoCount > 0 ? Math.min(selectedPhotoIdx, photoCount - 1) : 0;

  useEffect(() => {
    if (!open || !vehicle) return;
    const currentVehicle: PromoVehicle = vehicle;
    let cancelled = false;

    async function drawAllCanvases() {
      const photoSrc = resolvePromoPhotoSrc(currentVehicle, activePhotoIdx);
      const [, photoImg, logoImg] = await Promise.all([
        ensurePromoCanvasFonts(),
        loadSameOriginImage(photoSrc),
        loadSameOriginImage(PROMO_LOGO_SRC),
      ]);
      if (cancelled) return;

      const refs: Record<PromoArtKind, HTMLCanvasElement | null> = {
        feed: feedCanvasRef.current,
        story: storyCanvasRef.current,
        cover: coverCanvasRef.current,
      };

      for (const kind of PROMO_ART_ORDER) {
        const canvas = refs[kind];
        if (!canvas) continue;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        renderPromoArt(ctx, currentVehicle, kind, {
          photoImg: photoImg ?? null,
          logoImg: logoImg ?? null,
        });
      }
    }

    void drawAllCanvases();
    return () => {
      cancelled = true;
    };
  }, [open, vehicle, activePhotoIdx]);

  if (!open || !vehicle) return null;

  const cleanHeading = [
    sanitizePromoText(vehicle.brand),
    sanitizePromoText(vehicle.model),
    sanitizePromoText(vehicle.version),
  ]
    .filter(Boolean)
    .join(" ");

  const instagramText = buildInstagramPromo(vehicle);
  const whatsappText = buildWhatsAppPromo(vehicle);

  function getCanvasByKind(kind: PromoArtKind): HTMLCanvasElement | null {
    if (kind === "feed") return feedCanvasRef.current;
    if (kind === "story") return storyCanvasRef.current;
    return coverCanvasRef.current;
  }

  async function handleDownloadSingle(kind: PromoArtKind) {
    if (!vehicle) return;
    setErrorMessage(null);
    setBusyAction(kind);
    try {
      const canvas = getCanvasByKind(kind);
      if (!canvas) {
        throw new Error("Arte ainda não está pronta.");
      }
      const blob = await canvasToPngBlob(canvas);
      if (!blob) {
        throw new Error("Não foi possível gerar o arquivo PNG.");
      }
      const fileName = buildPromoFileName(vehicle, kind);
      triggerBlobDownload(blob, fileName);
      toast.success(`${PROMO_ART_SPECS[kind].shortLabel} baixado.`);
    } catch {
      const msg = "Não foi possível baixar a imagem agora. Tente novamente.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownloadAllZip() {
    if (!vehicle) return;
    setErrorMessage(null);
    setBusyAction("zip");
    try {
      const entries = [];
      for (const kind of PROMO_ART_ORDER) {
        const canvas = getCanvasByKind(kind);
        if (!canvas) {
          throw new Error("Arte não disponível.");
        }
        const blob = await canvasToPngBlob(canvas);
        if (!blob) {
          throw new Error("Falha ao exportar PNG.");
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        entries.push({
          name: buildPromoFileName(vehicle, kind),
          data: bytes,
        });
      }
      const zipBytes = buildZipArchive(entries);
      const zipBlob = new Blob([zipBytes.buffer as ArrayBuffer], {
        type: "application/zip",
      });
      triggerBlobDownload(zipBlob, buildPromoZipFileName(vehicle));
      toast.success("Pacote ZIP com as 3 artes baixado.");
    } catch {
      const msg = "Não foi possível gerar o pacote ZIP. Tente novamente.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCopyText(key: "instagram" | "whatsapp", value: string) {
    setErrorMessage(null);
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      toast.success("Texto copiado.");
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2500);
    } catch {
      const msg = "Não foi possível copiar automaticamente. Selecione o texto.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-asphalt/85 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-kit-title"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-5xl border border-white/20 bg-ink text-cream shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-brand" aria-hidden="true" />

        <div className="p-4 sm:p-6 space-y-6">
          {/* Cabeçalho */}
          <div className="flex items-start justify-between gap-4 border-b border-white/15 pb-4">
            <div>
              <h2
                id="promo-kit-title"
                className="font-display text-xl sm:text-2xl font-bold text-cream"
              >
                Kit de divulgação
              </h2>
              <p className="mt-1 font-body text-base text-cream/85">
                {cleanHeading}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar kit de divulgação"
              className="inline-flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center border border-white/20 bg-asphalt px-3 font-display text-base font-semibold text-cream transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand touch-manipulation"
            >
              Fechar
            </button>
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="border border-brand bg-asphalt p-4 font-body text-base text-cream"
            >
              {errorMessage}
            </div>
          ) : null}

          {/* Seletor simples de foto quando o veículo tem mais de uma */}
          {photoCount > 1 ? (
            <div className="space-y-2">
              <p className="font-display text-base font-semibold text-cream">
                Foto usada nas artes:
              </p>
              <div className="flex flex-wrap gap-2">
                {vehicle.photos?.slice(0, 8).map((_, idx) => {
                  const active = idx === activePhotoIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedPhotoIdx(idx)}
                      className={`min-h-[48px] min-w-[48px] border px-4 font-display text-base font-semibold transition touch-manipulation ${
                        active
                          ? "border-brand bg-brand text-white"
                          : "border-white/20 bg-asphalt text-cream hover:border-white/40"
                      }`}
                    >
                      Foto {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Bloco 1: Imagens e download */}
          <section className="space-y-4" aria-label="Artes prontas para baixar">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold text-cream">
                  1. Baixar imagens prontas
                </h3>
                <p className="font-body text-base text-cream/80">
                  Feed (1080×1350), Story/Status (1080×1920) e Capa (1080×1080)
                </p>
              </div>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleDownloadAllZip()}
                className="inline-flex min-h-[52px] items-center justify-center bg-brand px-6 font-display text-base font-bold text-white transition hover:brightness-110 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white touch-manipulation"
              >
                {busyAction === "zip"
                  ? "Preparando pacote..."
                  : "Baixar tudo (ZIP)"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {PROMO_ART_ORDER.map((kind) => {
                const spec = PROMO_ART_SPECS[kind];
                const canvasRef =
                  kind === "feed"
                    ? feedCanvasRef
                    : kind === "story"
                      ? storyCanvasRef
                      : coverCanvasRef;
                const buttonLabel =
                  kind === "feed"
                    ? "Baixar Feed"
                    : kind === "story"
                      ? "Baixar Story"
                      : "Baixar Capa";

                return (
                  <div
                    key={kind}
                    className="flex flex-col justify-between border border-white/15 bg-asphalt p-4 space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-base font-bold text-cream">
                          {spec.label}
                        </span>
                        <span className="border border-white/20 px-2 py-0.5 font-display text-base font-semibold text-cream/90">
                          {spec.width}×{spec.height}
                        </span>
                      </div>
                      <p className="mt-1 font-body text-base text-cream/75">
                        {spec.helperText}
                      </p>
                    </div>

                    <div className="flex items-center justify-center bg-ink/80 p-2 border border-white/10">
                      <canvas
                        ref={canvasRef}
                        width={spec.width}
                        height={spec.height}
                        className="max-h-64 w-auto max-w-full object-contain"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={busyAction !== null}
                      onClick={() => void handleDownloadSingle(kind)}
                      className="inline-flex min-h-[48px] w-full items-center justify-center border border-brand bg-brand/95 px-4 font-display text-base font-bold text-white transition hover:bg-brand disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white touch-manipulation"
                    >
                      {busyAction === kind ? "Baixando..." : buttonLabel}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bloco 2: Textos prontos */}
          <section
            className="space-y-4 border-t border-white/15 pt-5"
            aria-label="Textos prontos para copiar"
          >
            <h3 className="font-display text-lg font-bold text-cream">
              2. Copiar textos prontos
            </h3>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Legenda do Instagram */}
              <div className="flex flex-col justify-between border border-white/15 bg-asphalt p-4 space-y-3">
                <div className="space-y-2">
                  <h4 className="font-display text-base font-bold text-cream">
                    Legenda do Instagram
                  </h4>
                  <textarea
                    readOnly
                    rows={8}
                    value={instagramText}
                    aria-label="Legenda pronta para Instagram"
                    className="w-full border border-white/15 bg-ink p-3 font-body text-base leading-relaxed text-cream focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyText("instagram", instagramText)}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 border border-white/25 bg-ink px-4 font-display text-base font-bold text-cream transition hover:border-brand hover:bg-brand hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand touch-manipulation"
                >
                  <IconCopy className="h-5 w-5" />
                  {copiedKey === "instagram"
                    ? "Legenda copiada!"
                    : "Copiar legenda do Instagram"}
                </button>
              </div>

              {/* Mensagem para WhatsApp / Status */}
              <div className="flex flex-col justify-between border border-white/15 bg-asphalt p-4 space-y-3">
                <div className="space-y-2">
                  <h4 className="font-display text-base font-bold text-cream">
                    Mensagem para WhatsApp e Status
                  </h4>
                  <textarea
                    readOnly
                    rows={8}
                    value={whatsappText}
                    aria-label="Mensagem pronta para WhatsApp"
                    className="w-full border border-white/15 bg-ink p-3 font-body text-base leading-relaxed text-cream focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyText("whatsapp", whatsappText)}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 border border-white/25 bg-ink px-4 font-display text-base font-bold text-cream transition hover:border-brand hover:bg-brand hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand touch-manipulation"
                >
                  <IconCopy className="h-5 w-5" />
                  {copiedKey === "whatsapp"
                    ? "Texto copiado!"
                    : "Copiar texto do WhatsApp"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
