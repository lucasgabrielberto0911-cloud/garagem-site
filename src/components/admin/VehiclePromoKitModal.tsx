"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CONSIGNED_PROMO_BLOCKED_MESSAGE,
  PROMO_SERVICE_AREAS_TEXT,
  STORY_CARD_HEIGHT,
  STORY_CARD_WIDTH,
  buildInstagramPromo,
  buildWhatsAppPromo,
  canUseVehiclePromoKit,
  renderStoryCard,
  resolveStoryPhotoSrc,
  type PromoVehicle,
} from "@/lib/vehicle-promo-kit";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { site } from "@/lib/site";
import { resolveTransmission } from "@/lib/vehicle-display";
import { vehicleSlug } from "@/lib/vehicle-slug";
import { IconCopy } from "@/components/admin/icons";

function resolveStoryFontFamily(): string {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const cssVar = window
      .getComputedStyle(document.body)
      .getPropertyValue("--font-display")
      .trim();
    if (cssVar) {
      return `${cssVar}, "Sora", sans-serif`;
    }
  }
  return '"Sora", sans-serif';
}

function loadSameOriginPhoto(src: string): Promise<HTMLImageElement | undefined> {
  if (!src) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = src;
  });
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
  const [tab, setTab] = useState<"whatsapp" | "instagram" | "card">("whatsapp");
  const [copied, setCopied] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !vehicle) return null;

  const allowed = canUseVehiclePromoKit(vehicle);

  if (!allowed) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-asphalt/80 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promo-kit-title"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md border border-white/20 bg-ink shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1 bg-brand-gradient" aria-hidden="true" />
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="promo-kit-title"
                  className="font-display text-lg font-semibold text-cream"
                >
                  Kit de Divulgação
                </h2>
                <p className="mt-0.5 text-xs text-cream/80">
                  {vehicle.brand} {vehicle.model} {vehicle.version ?? ""}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center text-cream/80 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand touch-manipulation"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div
              role="alert"
              data-testid="consigned-promo-modal-blocked"
              className="mt-4 border border-white/15 bg-asphalt p-4 text-sm leading-relaxed text-cream/90"
            >
              {CONSIGNED_PROMO_BLOCKED_MESSAGE}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSold = vehicle.status === "vendido";
  const whatsappText = buildWhatsAppPromo(vehicle);
  const instagramText = buildInstagramPromo(vehicle);
  const slug = vehicleSlug(vehicle);
  const storyPhotoSrc = resolveStoryPhotoSrc(vehicle);
  const normalizedTransmission = resolveTransmission(
    vehicle.version,
    vehicle.transmission,
  );
  const yearLabel =
    vehicle.year === vehicle.yearModel
      ? `${vehicle.year}`
      : `${vehicle.year}/${vehicle.yearModel}`;
  const previewSpecs = [
    yearLabel,
    `${formatNumberBR(vehicle.km)} km`,
    normalizedTransmission,
  ]
    .filter(Boolean)
    .join(" · ");

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  async function downloadStoryCard() {
    if (!vehicle || !canUseVehiclePromoKit(vehicle)) return;
    const currentVehicle = vehicle;
    const currentCanvas = canvasRef.current;
    if (!currentCanvas) {
      setDownloading(false);
      return;
    }

    setDownloading(true);

    try {
      const ctx = currentCanvas.getContext("2d");
      if (!ctx) {
        toast.error("Erro ao gerar a imagem.");
        return;
      }

      if (typeof document !== "undefined" && document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // Segue com a pilha Sora definida
        }
      }

      const photoImg = await loadSameOriginPhoto(
        resolveStoryPhotoSrc(currentVehicle),
      );

      currentCanvas.width = STORY_CARD_WIDTH;
      currentCanvas.height = STORY_CARD_HEIGHT;

      renderStoryCard(ctx, currentVehicle, {
        photoImg,
        fontFamily: resolveStoryFontFamily(),
      });

      const dataUrl = currentCanvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `divulgacao-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Card baixado com sucesso!");
    } catch {
      toast.error("Erro ao gerar a imagem.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-asphalt/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-kit-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl border border-white/20 bg-ink shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 bg-brand-gradient" aria-hidden="true" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="promo-kit-title"
                className="font-display text-lg font-semibold text-cream"
              >
                Kit de Divulgação
              </h2>
              <p className="mt-0.5 text-xs text-cream/80">
                {vehicle.brand} {vehicle.model} {vehicle.version ?? ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 min-h-11 min-w-11 shrink-0 items-center justify-center text-cream/80 hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand touch-manipulation"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          <nav className="mt-4 flex border-b border-white/15 text-xs font-semibold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setTab("whatsapp")}
              className={`min-h-[44px] flex-1 border-b-2 px-3 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                tab === "whatsapp"
                  ? "border-brand text-cream"
                  : "border-transparent text-cream/80 hover:text-cream"
              }`}
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setTab("instagram")}
              className={`min-h-[44px] flex-1 border-b-2 px-3 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                tab === "instagram"
                  ? "border-brand text-cream"
                  : "border-transparent text-cream/80 hover:text-cream"
              }`}
            >
              Instagram
            </button>
            <button
              type="button"
              onClick={() => setTab("card")}
              className={`min-h-[44px] flex-1 border-b-2 px-3 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                tab === "card"
                  ? "border-brand text-cream"
                  : "border-transparent text-cream/80 hover:text-cream"
              }`}
            >
              Card Status (PNG)
            </button>
          </nav>

          <div className="mt-4">
            {tab === "whatsapp" && (
              <div className="space-y-3">
                <p className="text-xs text-cream/80">
                  Texto formatado com emojis e link para disparo ou status:
                </p>
                <textarea
                  readOnly
                  value={whatsappText}
                  rows={8}
                  className="w-full resize-none border border-white/20 bg-asphalt p-3 font-body text-xs text-cream outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/60"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(whatsappText, "Texto WhatsApp")}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 bg-brand px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
                >
                  <IconCopy className="h-4 w-4" />
                  {copied === "Texto WhatsApp"
                    ? "Copiado!"
                    : "Copiar texto do WhatsApp"}
                </button>
              </div>
            )}

            {tab === "instagram" && (
              <div className="space-y-3">
                <p className="text-xs text-cream/80">
                  Legenda pronta para feed ou reels, com ficha e hashtags:
                </p>
                <textarea
                  readOnly
                  value={instagramText}
                  rows={8}
                  className="w-full resize-none border border-white/20 bg-asphalt p-3 font-body text-xs text-cream outline-none focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/60"
                />
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(instagramText, "Legenda Instagram")
                  }
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 bg-brand px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream"
                >
                  <IconCopy className="h-4 w-4" />
                  {copied === "Legenda Instagram"
                    ? "Copiada!"
                    : "Copiar legenda do Instagram"}
                </button>
              </div>
            )}

            {tab === "card" && (
              <div className="space-y-3">
                <p className="text-xs text-cream/80">
                  Card vertical de alta resolução (1080×1920) com foto 4:3 e
                  fundo desfocado para Instagram Stories e WhatsApp Status:
                </p>
                <div className="flex justify-center border border-white/20 bg-asphalt p-4">
                  <div className="relative flex aspect-[9/16] w-52 flex-col justify-between overflow-hidden rounded border border-white/25 bg-asphalt p-3 text-center shadow">
                    <div>
                      <div className="h-0.5 bg-brand-gradient" />
                      <p className="mt-1.5 font-display text-xs font-bold tracking-widest text-cream">
                        GARAGEM
                      </p>
                      <div className="relative mt-2 flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-ink text-xs text-cream/80">
                        {storyPhotoSrc ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element -- rota local same-origin /api/fotos/story */}
                            <img
                              src={storyPhotoSrc}
                              alt=""
                              aria-hidden="true"
                              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-75 blur-md"
                            />
                            {/* eslint-disable-next-line @next/next/no-img-element -- rota local same-origin /api/fotos/story */}
                            <img
                              src={storyPhotoSrc}
                              alt=""
                              className="relative z-10 h-full w-full object-contain"
                            />
                          </>
                        ) : (
                          "Sem foto"
                        )}
                      </div>
                      <p className="mt-2 truncate font-display text-xs font-bold text-cream">
                        {vehicle.brand} {vehicle.model}
                      </p>
                      <p className="truncate font-display text-[10px] text-cream/80">
                        {previewSpecs}
                      </p>
                      <div
                        className={`mt-2 py-1 text-center font-display text-xs font-bold ${
                          !isSold
                            ? "bg-brand text-white"
                            : "bg-white/10 text-cream/70"
                        }`}
                      >
                        {!isSold ? formatCurrencyBRL(vehicle.price) : "VENDIDO"}
                      </div>
                    </div>

                    <div className="space-y-0.5 pt-2">
                      <p className="font-display text-[10px] font-semibold text-cream">
                        WhatsApp {site.whatsappLabel}
                      </p>
                      <p className="font-display text-[9px] leading-tight text-cream/75">
                        {PROMO_SERVICE_AREAS_TEXT}
                      </p>
                    </div>
                  </div>
                </div>

                <canvas ref={canvasRef} className="hidden" />

                <button
                  type="button"
                  onClick={() => void downloadStoryCard()}
                  disabled={downloading}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 bg-brand px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream disabled:opacity-60"
                >
                  {downloading
                    ? "Gerando imagem..."
                    : "Baixar card para Status/Stories (PNG)"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
