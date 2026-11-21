"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { PUBLIC_PHOTO_PREFIX, publicPhotoSrc } from "@/lib/public-photo-url";

const VEHICLE_PLACEHOLDER_PATH = "/branding/placeholder-car.png";
const PORTRAIT_FRAME_ASPECT = 4 / 5;
const ALPHA_SAMPLE_WIDTH = 96;
const ALPHA_THRESHOLD = 20;
const FRAMING_FALLBACK_TIMEOUT_MS = 2000;

export interface AlphaBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  transparentRatio: number;
}

export function measureImageAlphaBounds(
  img: HTMLImageElement,
): AlphaBounds | null {
  const { naturalWidth, naturalHeight } = img;
  if (!naturalWidth || !naturalHeight) return null;

  const sampleWidth = ALPHA_SAMPLE_WIDTH;
  const sampleHeight = Math.max(
    1,
    Math.round((ALPHA_SAMPLE_WIDTH * naturalHeight) / naturalWidth),
  );

  try {
    const canvas = document.createElement("canvas");
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight);
    const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);

    let minX = sampleWidth;
    let minY = sampleHeight;
    let maxX = -1;
    let maxY = -1;
    let transparentCount = 0;
    const totalPixels = sampleWidth * sampleHeight;

    for (let y = 0; y < sampleHeight; y += 1) {
      for (let x = 0; x < sampleWidth; x += 1) {
        const alpha = data[(y * sampleWidth + x) * 4 + 3];
        if (alpha >= ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        } else {
          transparentCount += 1;
        }
      }
    }

    if (maxX < minX || maxY < minY) return null;

    return {
      minX: minX / sampleWidth,
      minY: minY / sampleHeight,
      maxX: (maxX + 1) / sampleWidth,
      maxY: (maxY + 1) / sampleHeight,
      transparentRatio: transparentCount / totalPixels,
    };
  } catch {
    // Fallback silencioso para origem externa sem CORS (SecurityError/taint) ou falha de decodificação.
    return null;
  }
}

export function computeFounderCutoutStyle(
  naturalWidth: number,
  naturalHeight: number,
  bounds: AlphaBounds,
  frameAspect = PORTRAIT_FRAME_ASPECT,
): CSSProperties | null {
  if (naturalWidth <= 0 || naturalHeight <= 0) return null;
  if (bounds.transparentRatio < 0.15) return null;

  const marginLeft = bounds.minX;
  const marginRight = 1 - bounds.maxX;
  const marginTop = bounds.minY;
  const marginBottom = 1 - bounds.maxY;
  if (
    marginLeft <= 0.12 &&
    marginRight <= 0.12 &&
    marginTop <= 0.12 &&
    marginBottom <= 0.12
  ) {
    return null;
  }

  const subW = bounds.maxX - bounds.minX;
  const subH = bounds.maxY - bounds.minY;
  if (subW <= 0.05 || subH <= 0.05) return null;

  const imgAspect = naturalWidth / naturalHeight;
  const touchesLeft = bounds.minX < 0.02;
  const touchesRight = bounds.maxX > 0.98;
  const touchesTop = bounds.minY < 0.03;
  const touchesBottom = bounds.maxY > 0.98;
  const headroomPct = touchesTop ? 0 : 6;

  const desiredWidthPct = 86 / subW;
  let imgWidthPct: number;

  if (touchesBottom) {
    const minWidthForBottom =
      ((100 - headroomPct) / (1 - bounds.minY)) * (imgAspect / frameAspect);
    const maxWidthForTorso =
      ((100 - headroomPct) / (0.8 * subH)) * (imgAspect / frameAspect);
    imgWidthPct = Math.min(
      Math.max(desiredWidthPct, minWidthForBottom, 100),
      Math.max(minWidthForBottom, maxWidthForTorso),
    );
  } else {
    const maxWidthFitH =
      ((100 - headroomPct) / subH) * (imgAspect / frameAspect);
    imgWidthPct = Math.min(desiredWidthPct, maxWidthFitH);
  }

  const imgHeightPct = imgWidthPct * (frameAspect / imgAspect);

  let leftPct: number;
  if (touchesRight && !touchesLeft) {
    leftPct = 100 - imgWidthPct;
  } else if (touchesLeft && !touchesRight) {
    leftPct = 0;
  } else if (touchesLeft && touchesRight) {
    leftPct = Math.min(
      0,
      Math.max(
        100 - imgWidthPct,
        50 - ((bounds.minX + bounds.maxX) / 2) * imgWidthPct,
      ),
    );
  } else {
    leftPct = 50 - ((bounds.minX + bounds.maxX) / 2) * imgWidthPct;
  }

  let topPct = touchesBottom
    ? Math.max(100 - imgHeightPct, headroomPct - bounds.minY * imgHeightPct)
    : 50 - ((bounds.minY + bounds.maxY) / 2) * imgHeightPct;
  if (touchesTop && topPct > 0) {
    topPct = 0;
  }

  return {
    width: `${imgWidthPct.toFixed(2)}%`,
    height: `${imgHeightPct.toFixed(2)}%`,
    left: `${leftPct.toFixed(2)}%`,
    top: `${topPct.toFixed(2)}%`,
    right: "auto",
    bottom: "auto",
    maxWidth: "none",
  };
}

export function FounderSection({
  photoUrl,
}: {
  photoUrl?: string | null;
}) {
  const rawPhotoUrl = photoUrl?.trim() || null;
  const resolvedPortrait = rawPhotoUrl ? publicPhotoSrc(rawPhotoUrl) : null;
  const portrait =
    resolvedPortrait === VEHICLE_PLACEHOLDER_PATH &&
    rawPhotoUrl !== VEHICLE_PLACEHOLDER_PATH
      ? null
      : resolvedPortrait;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [framing, setFraming] = useState<{
    src: string;
    style: CSSProperties | null;
  } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const showPortrait = Boolean(portrait && failedSrc !== portrait);
  const isPortraitReady = framing?.src === portrait;
  const activeCutoutStyle = isPortraitReady ? framing.style : null;

  useEffect(() => {
    const img = imgRef.current;
    if (!portrait || !img) return;

    let fallbackTimer: number | undefined;
    const clearFallbackTimer = () => {
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = undefined;
      }
    };

    const markFailed = () => {
      clearFallbackTimer();
      setFailedSrc(portrait);
    };
    const updateFraming = () => {
      clearFallbackTimer();
      const bounds = measureImageAlphaBounds(img);
      const nextStyle = bounds
        ? computeFounderCutoutStyle(
            img.naturalWidth,
            img.naturalHeight,
            bounds,
          )
        : null;
      // Fallback: se o canvas falhar (SecurityError/taint, decodificação) ou for foto opaca, revela com enquadramento padrão.
      setFraming({ src: portrait, style: nextStyle });
    };

    if (img.complete) {
      if (img.naturalWidth === 0 && Boolean(img.currentSrc)) {
        markFailed();
        return;
      }
      if (img.naturalWidth > 0) {
        updateFraming();
      }
    }

    if (!(img.complete && img.naturalWidth > 0)) {
      fallbackTimer = window.setTimeout(() => {
        // Fallback de timeout: nunca mantém o retrato oculto caso o evento load atrase ou não dispare.
        setFraming((current) =>
          current?.src === portrait ? current : { src: portrait, style: null },
        );
      }, FRAMING_FALLBACK_TIMEOUT_MS);
    }

    img.addEventListener("error", markFailed);
    img.addEventListener("load", updateFraming);
    return () => {
      clearFallbackTimer();
      img.removeEventListener("error", markFailed);
      img.removeEventListener("load", updateFraming);
    };
  }, [portrait]);

  return (
    <section
      id="por-tras"
      aria-labelledby="titulo-por-tras"
      className="mx-auto mt-10 max-w-5xl scroll-mt-28 overflow-hidden bg-ink sm:mt-12"
    >
      <div
        className={
          showPortrait
            ? "grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] lg:items-center"
            : ""
        }
      >
        {showPortrait && portrait ? (
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-gradient-to-br from-ink via-asphalt to-ink sm:mx-auto sm:mt-8 sm:max-w-md lg:order-2 lg:mt-0 lg:max-w-none lg:self-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_55%_36%,rgba(217,21,25,0.28),transparent_68%)]"
            />
            <Image
              ref={imgRef}
              src={portrait}
              alt="Elias Clovis Gonçalves dos Santos Neto, dono e sócio-administrador da Garagem"
              fill
              loading="eager"
              sizes="(min-width: 1024px) 450px, (min-width: 640px) 448px, 100vw"
              quality={90}
              unoptimized={
                portrait.startsWith(PUBLIC_PHOTO_PREFIX) ||
                /^https?:\/\//i.test(portrait)
              }
              style={activeCutoutStyle ?? undefined}
              className={[
                activeCutoutStyle
                  ? "object-contain"
                  : "object-cover object-[50%_20%]",
                "transition-opacity duration-150",
                isPortraitReady
                  ? "opacity-100"
                  : "[@media(scripting:enabled)]:opacity-0",
              ].join(" ")}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/5 bg-gradient-to-t from-ink/75 via-ink/20 to-transparent"
            />
          </div>
        ) : null}

        <div
          className={
            showPortrait
              ? "flex flex-col justify-center px-6 py-9 sm:px-10 sm:py-11 lg:order-1 lg:px-12 lg:py-12"
              : "mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14"
          }
        >
          <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-brand-light">
            Quem está por trás da Garagem?
          </p>
          <h2
            id="titulo-por-tras"
            className="mt-3 font-display text-2xl font-bold tracking-tight text-cream sm:text-3xl"
          >
            Elias Clovis Gonçalves dos Santos Neto
          </h2>
          <p className="mt-2 text-sm font-medium text-cream/85">
            Dono e sócio-administrador
          </p>
          <div
            className="mt-5 h-0.5 w-12 bg-brand-gradient"
            aria-hidden="true"
          />

          <div className="mt-6 space-y-4 text-sm leading-relaxed text-cream/80 sm:text-[15px]">
            <p>
              Natural de Feira de Santana, na Bahia, Elias construiu a vida no
              mercado de veículos. Há mais de 20 anos ele compra, avalia e vende
              veículos — um ofício que trata como conversa de confiança, não como
              pressão de balcão.
            </p>
            <p>
              Foi essa estrada que o trouxe à frente da Garagem: atendemos
              Linhares, Aracruz e Grande Vitória e combinamos o atendimento pelo
              WhatsApp, para quem busca seminovo com procedência e alguém do
              outro lado que realmente resolve.
            </p>
            <p>
              O foco dele é simples e difícil de fingir: entregar a melhor
              experiência para cada cliente. Do primeiro “olá” ao vídeo do veículo,
              da troca à transferência, o padrão é o mesmo — clareza no preço,
              seriedade na procedência e cuidado com o que pesa no bolso e na
              decisão.
            </p>
            <p>
              Por isso a Garagem não é só estoque na tela. É o jeito de Elias de
              trabalhar: perto de quem compra, disponível todos os dias e
              comprometido com o resultado de cada negócio — um cliente de cada
              vez.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
