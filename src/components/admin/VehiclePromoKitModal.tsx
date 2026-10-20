"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  buildWhatsAppPromo,
  buildInstagramPromo,
  type PromoVehicle,
} from "@/lib/vehicle-promo-kit";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { vehicleSlug } from "@/lib/vehicle-slug";
import { IconCopy } from "@/components/admin/icons";

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

  const isSold = vehicle.status === "vendido";
  const whatsappText = buildWhatsAppPromo(vehicle);
  const instagramText = buildInstagramPromo(vehicle);
  const slug = vehicleSlug(vehicle);

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

  function downloadStoryCard() {
    if (!vehicle) return;
    const currentVehicle = vehicle;
    const currentCanvas = canvasRef.current;
    if (!currentCanvas) {
      setDownloading(false);
      return;
    }

    setDownloading(true);

    const ctx = currentCanvas.getContext("2d");
    if (!ctx) {
      setDownloading(false);
      return;
    }

    // 1080 x 1920 (Instagram Stories / WhatsApp Status)
    const W = 1080;
    const H = 1920;
    currentCanvas.width = W;
    currentCanvas.height = H;

    // Fundo asfalto
    ctx.fillStyle = "#0D0D0F";
    ctx.fillRect(0, 0, W, H);

    // Filete da marca no topo
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#E8181C");
    grad.addColorStop(0.5, "#FF8A00");
    grad.addColorStop(1, "#FFC72C");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 16);

    // Topo: Marca GARAGEM
    ctx.fillStyle = "#F7F5F2";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GARAGEM", W / 2, 120);

    ctx.fillStyle = "#A1A1AA";
    ctx.font = "500 28px sans-serif";
    ctx.fillText("SEMINOVOS SELECIONADOS", W / 2, 165);

    function drawContent(photoImg?: HTMLImageElement) {
      if (!ctx || !currentCanvas) return;
      // Área de foto
      const photoY = 220;
      const photoH = 880;
      const photoW = W - 120;
      const photoX = 60;

      ctx.fillStyle = "#18181B";
      ctx.fillRect(photoX, photoY, photoW, photoH);

      if (photoImg && photoImg.complete && photoImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(photoX, photoY, photoW, photoH);
        ctx.clip();
        // Object-fit cover
        const imgRatio = photoImg.naturalWidth / photoImg.naturalHeight;
        const boxRatio = photoW / photoH;
        let dw = photoW;
        let dh = photoH;
        let dx = photoX;
        let dy = photoY;
        if (imgRatio > boxRatio) {
          dw = photoH * imgRatio;
          dx = photoX - (dw - photoW) / 2;
        } else {
          dh = photoW / imgRatio;
          dy = photoY - (dh - photoH) / 2;
        }
        ctx.drawImage(photoImg, dx, dy, dw, dh);
        ctx.restore();
      }

      // Detalhes do veículo abaixo da foto
      const infoY = photoY + photoH + 70;
      ctx.textAlign = "center";

      // Marca + Modelo
      ctx.fillStyle = "#F7F5F2";
      ctx.font = "bold 64px sans-serif";
      const title = `${currentVehicle.brand} ${currentVehicle.model}`;
      ctx.fillText(title, W / 2, infoY);

      // Versão
      if (currentVehicle.version) {
        ctx.fillStyle = "#D4D4D8";
        ctx.font = "40px sans-serif";
        ctx.fillText(currentVehicle.version, W / 2, infoY + 60);
      }

      // Chips de dados (Ano, KM, Câmbio)
      const yearText =
        currentVehicle.year === currentVehicle.yearModel
          ? `${currentVehicle.year}`
          : `${currentVehicle.year}/${currentVehicle.yearModel}`;
      const chips = [
        `Ano ${yearText}`,
        `${formatNumberBR(currentVehicle.km)} km`,
        currentVehicle.transmission,
        currentVehicle.fuel,
      ].filter(Boolean);

      const chipY = infoY + 140;
      ctx.font = "600 32px sans-serif";
      const chipText = chips.join("  •  ");
      ctx.fillStyle = "#A1A1AA";
      ctx.fillText(chipText, W / 2, chipY);

      // Bloco de Preço
      const priceY = chipY + 110;
      if (!isSold) {
        ctx.fillStyle = "#E8181C";
        ctx.fillRect(W / 2 - 280, priceY - 60, 560, 100);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 52px sans-serif";
        ctx.fillText(formatCurrencyBRL(currentVehicle.price), W / 2, priceY + 12);
      } else {
        ctx.fillStyle = "#27272A";
        ctx.fillRect(W / 2 - 240, priceY - 60, 480, 100);
        ctx.fillStyle = "#A1A1AA";
        ctx.font = "bold 44px sans-serif";
        ctx.fillText("VENDIDO", W / 2, priceY + 10);
      }

      // Rodapé
      ctx.fillStyle = "#71717A";
      ctx.font = "32px sans-serif";
      ctx.fillText("suagaragem.net  •  Linhares / ES", W / 2, H - 90);

      // Trigger download
      try {
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

    const coverPhoto = currentVehicle.photos?.[0]?.url;
    if (coverPhoto) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => drawContent(img);
      img.onerror = () => drawContent();
      img.src = coverPhoto;
    } else {
      drawContent();
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
        className="w-full max-w-xl border border-white/10 bg-ink shadow-2xl"
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
              <p className="mt-0.5 text-xs text-muted">
                {vehicle.brand} {vehicle.model} {vehicle.version ?? ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-cream"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          <nav className="mt-4 flex border-b border-white/10 text-xs font-semibold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setTab("whatsapp")}
              className={`min-h-[44px] flex-1 border-b-2 px-3 py-2 text-center transition ${
                tab === "whatsapp"
                  ? "border-brand text-cream"
                  : "border-transparent text-muted hover:text-cream"
              }`}
            >
              WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setTab("instagram")}
              className={`min-h-[44px] flex-1 border-b-2 px-3 py-2 text-center transition ${
                tab === "instagram"
                  ? "border-brand text-cream"
                  : "border-transparent text-muted hover:text-cream"
              }`}
            >
              Instagram
            </button>
            <button
              type="button"
              onClick={() => setTab("card")}
              className={`min-h-[44px] flex-1 border-b-2 px-3 py-2 text-center transition ${
                tab === "card"
                  ? "border-brand text-cream"
                  : "border-transparent text-muted hover:text-cream"
              }`}
            >
              Card Status (PNG)
            </button>
          </nav>

          <div className="mt-4">
            {tab === "whatsapp" && (
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  Texto formatado com emojis e link para disparo ou status:
                </p>
                <textarea
                  readOnly
                  value={whatsappText}
                  rows={8}
                  className="w-full resize-none border border-white/10 bg-asphalt p-3 font-body text-xs text-cream outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(whatsappText, "Texto WhatsApp")}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 bg-brand px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-cream transition hover:bg-brand/90"
                >
                  <IconCopy className="h-4 w-4" />
                  {copied === "Texto WhatsApp" ? "Copiado!" : "Copiar texto do WhatsApp"}
                </button>
              </div>
            )}

            {tab === "instagram" && (
              <div className="space-y-3">
                <p className="text-xs text-muted">
                  Legenda pronta para feed ou reels, com ficha e hashtags:
                </p>
                <textarea
                  readOnly
                  value={instagramText}
                  rows={8}
                  className="w-full resize-none border border-white/10 bg-asphalt p-3 font-body text-xs text-cream outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(instagramText, "Legenda Instagram")
                  }
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 bg-brand px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-cream transition hover:bg-brand/90"
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
                <p className="text-xs text-muted">
                  Card vertical de alta resolução (1080×1920) ideal para
                  Instagram Stories e WhatsApp Status:
                </p>
                <div className="flex justify-center border border-white/10 bg-asphalt p-4">
                  <div className="relative aspect-[9/16] w-48 overflow-hidden rounded border border-white/20 bg-ink p-3 text-center shadow">
                    <div className="h-0.5 bg-brand-gradient" />
                    <p className="mt-1 font-display text-[9px] font-bold tracking-widest text-cream">
                      GARAGEM
                    </p>
                    <div className="mt-2 aspect-square w-full rounded bg-white/5 object-cover flex items-center justify-center text-[10px] text-muted">
                      {vehicle.photos?.[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={vehicle.photos[0].url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        "Sem foto"
                      )}
                    </div>
                    <p className="mt-2 truncate font-display text-xs font-bold text-cream">
                      {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="text-[10px] text-muted">
                      {vehicle.year} · {formatNumberBR(vehicle.km)} km
                    </p>
                    <div className="mt-2 rounded bg-brand py-1 text-center font-display text-[10px] font-bold text-cream">
                      {!isSold ? formatCurrencyBRL(vehicle.price) : "VENDIDO"}
                    </div>
                  </div>
                </div>

                <canvas ref={canvasRef} className="hidden" />

                <button
                  type="button"
                  onClick={downloadStoryCard}
                  disabled={downloading}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 bg-brand px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-cream transition hover:bg-brand/90 disabled:opacity-60"
                >
                  {downloading ? "Gerando imagem..." : "Baixar card para Status/Stories (PNG)"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
