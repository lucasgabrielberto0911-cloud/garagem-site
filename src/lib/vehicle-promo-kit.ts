import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { site } from "@/lib/site";
import { inferGearFromText, resolveTransmission } from "@/lib/vehicle-display";
import {
  vehiclePath,
  vehicleSlug,
  type VehiclePathInput,
} from "@/lib/vehicle-slug";

/** Vermelho oficial extraído do logo real da Garagem (nunca dourado). */
export const PROMO_BRAND_RED = "#F80000";
export const PROMO_BRAND_RED_DARK = "#B80000";
export const PROMO_BG_DARK = "#0D0D0F";
export const PROMO_SURFACE_DARK = "#16161A";
export const PROMO_BORDER_DARK = "#2A2A30";

export const PROMO_TRADE_FINANCE_TEXT = "ACEITAMOS TROCA · FINANCIAMOS";
export const PROMO_SERVICE_AREAS_TEXT =
  "Atendemos Linhares, Aracruz e Grande Vitória";
export const PROMO_APPOINTMENT_TEXT =
  "Combinamos o atendimento pelo WhatsApp";
export const PROMO_DOMAIN_TEXT = "suagaragem.net";
export const PROMO_LOGO_SRC = "/branding/logo-wordmark.png";

export type PromoArtKind = "feed" | "story" | "cover";

export type PhotoPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PromoSafeArea = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type PromoArtSpec = {
  kind: PromoArtKind;
  label: string;
  shortLabel: string;
  helperText: string;
  width: number;
  height: number;
  ratioLabel: string;
  fileSuffix: string;
  photoBox: PhotoPlacement;
  safeArea: PromoSafeArea;
};

export const FEED_CARD_WIDTH = 1080;
export const FEED_CARD_HEIGHT = 1350;
export const STORY_CARD_WIDTH = 1080;
export const STORY_CARD_HEIGHT = 1920;
export const COVER_CARD_WIDTH = 1440;
export const COVER_CARD_HEIGHT = 1080;

export const FEED_PHOTO_BOX: PhotoPlacement = {
  x: 60,
  y: 112,
  width: 960,
  height: 720,
};

export const STORY_PHOTO_BOX: PhotoPlacement = {
  x: 60,
  y: 340,
  width: 960,
  height: 720,
};

export const COVER_PHOTO_BOX: PhotoPlacement = {
  x: 56,
  y: 126,
  width: 880,
  height: 660,
};

export const PROMO_ART_SPECS: Record<PromoArtKind, PromoArtSpec> = {
  feed: {
    kind: "feed",
    label: "Feed do Instagram",
    shortLabel: "Feed",
    helperText: "Retrato 1080×1350 para publicar no feed",
    width: FEED_CARD_WIDTH,
    height: FEED_CARD_HEIGHT,
    ratioLabel: "4:5",
    fileSuffix: "feed-1080x1350",
    photoBox: FEED_PHOTO_BOX,
    safeArea: { top: 24, bottom: 1326, left: 60, right: 1020 },
  },
  story: {
    kind: "story",
    label: "Story e Status",
    shortLabel: "Story",
    helperText: "Tela cheia 1080×1920 para Stories e Status do WhatsApp",
    width: STORY_CARD_WIDTH,
    height: STORY_CARD_HEIGHT,
    ratioLabel: "9:16",
    fileSuffix: "story-1080x1920",
    photoBox: STORY_PHOTO_BOX,
    safeArea: { top: 240, bottom: 1660, left: 60, right: 1020 },
  },
  cover: {
    kind: "cover",
    label: "Capa do anúncio",
    shortLabel: "Capa",
    helperText: "Horizontal 1440×1080 (4:3) para portais, grupos e vitrine",
    width: COVER_CARD_WIDTH,
    height: COVER_CARD_HEIGHT,
    ratioLabel: "4:3",
    fileSuffix: "capa-1440x1080",
    photoBox: COVER_PHOTO_BOX,
    safeArea: { top: 24, bottom: 1056, left: 56, right: 1384 },
  },
};

export const PROMO_ART_ORDER: readonly PromoArtKind[] = [
  "feed",
  "story",
  "cover",
] as const;

export type PromoVehicle = VehiclePathInput & {
  year: number;
  km: number;
  transmission?: string | null;
  fuel?: string | null;
  color?: string | null;
  price: number;
  status: string;
  consigned?: boolean | null;
  plate?: string | null;
  chassis?: string | null;
  renavam?: string | null;
  accessories?: string[] | string | null;
  photos?: Array<{ id?: string; url: string; thumbnailUrl?: string | null }>;
};

export type StoryPhotoLayout = {
  box: PhotoPlacement;
  needsBlurredBackdrop: boolean;
  backdrop: PhotoPlacement;
  foreground: PhotoPlacement;
};

export type SealCircleLayout = {
  cx: number;
  cy: number;
  radius: number;
  width: number;
  height: number;
  innerBox: PhotoPlacement;
};

export type PromoImageSource = {
  complete?: boolean;
  naturalWidth: number;
  naturalHeight: number;
};

export type PromoCanvasContext2D = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "font"
  | "textAlign"
  | "fillRect"
  | "fillText"
  | "save"
  | "restore"
  | "beginPath"
  | "rect"
  | "clip"
> & {
  strokeStyle?: string | CanvasGradient | CanvasPattern;
  lineWidth?: number;
  textBaseline?: CanvasTextBaseline;
  filter?: string;
  strokeRect?: (x: number, y: number, w: number, h: number) => void;
  moveTo?: (x: number, y: number) => void;
  lineTo?: (x: number, y: number) => void;
  closePath?: () => void;
  fill?: () => void;
  stroke?: () => void;
  arc?: (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ) => void;
  measureText?: (text: string) => { width: number };
  drawImage(
    image: HTMLImageElement,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
};

export type StoryImageSource = PromoImageSource;
export type StoryCanvasContext2D = PromoCanvasContext2D;

/**
 * O Kit de Divulgação funciona tanto para veículos do estoque próprio quanto
 * para consignados (sem expor "consignado" nas peças geradas).
 */
export function canUseVehiclePromoKit(
  vehicle: { id?: string | null; consigned?: boolean | null } | null | undefined,
): boolean {
  return Boolean(vehicle);
}

/**
 * Remove qualquer ocorrência acidental de placa (antiga ou Mercosul), chassi/VIN,
 * RENAVAM, potência (cv), marchas e a palavra interna "consignado".
 */
export function sanitizePromoText(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/\b(?:placa\s*:?\s*)?[A-Z]{3}-?\d[A-Z0-9]\d{2}\b/gi, " ")
    .replace(/\b(?:renavam\s*:?\s*)\d{9,11}\b/gi, " ")
    .replace(/\b\d{11}\b/g, " ")
    .replace(
      /\b(?:chassi\s*:?\s*)?(?=[A-HJ-NPR-Z0-9]*\d)(?=[A-HJ-NPR-Z0-9]*[A-HJ-NPR-Z])[A-HJ-NPR-Z0-9]{17}\b/gi,
      " ",
    )
    .replace(/\b\d{2,4}\s*cv\b/gi, " ")
    .replace(/\b\d{1,2}\s*marchas?\b/gi, " ")
    .replace(
      /\b(?:[ei]-?cvt|cvt|dualogic|i-?motion|easytronic|automatizad[oa]|semi[\s-]*autom[aá]tic[oa]|semiautom[aá]tic[oa])\b/gi,
      " ",
    )
    .replace(/\bconsignad[oa]s?\b/gi, " ")
    .replace(/\s*[·•/-]\s*(?=[·•/-]|$)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s·•,-]+|[\s·•,-]+$/g, "")
    .trim();
}

/**
 * Nas artes e legendas do Kit de Divulgação, o câmbio é sempre normalizado
 * exclusivamente para "Manual" ou "Automático" (CVT, automatizado e
 * semi-automático entram como "Automático").
 */
export function resolvePromoTransmission(
  version: string | null | undefined,
  transmission: string | null | undefined,
): "Manual" | "Automático" | "" {
  const canonical = resolveTransmission(version, transmission);
  const kind =
    inferGearFromText(canonical) ??
    inferGearFromText(version ?? "") ??
    inferGearFromText(transmission ?? "");
  if (kind === "manual") return "Manual";
  if (
    kind === "automatico" ||
    kind === "cvt" ||
    kind === "automatizado" ||
    kind === "semi"
  ) {
    return "Automático";
  }
  return "";
}

export function formatPromoYear(
  vehicle: Pick<PromoVehicle, "year" | "yearModel">,
): string {
  return vehicle.year === vehicle.yearModel
    ? `${vehicle.year}`
    : `${vehicle.year}/${vehicle.yearModel}`;
}

export function formatPromoKm(km: number): string {
  const safeKm = Number.isFinite(km) ? Math.max(0, Math.round(km)) : 0;
  return `${formatNumberBR(safeKm)} km`;
}

export function formatPromoTag(value: string): string {
  return sanitizePromoText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Converte a foto escolhida para rota local `/api/fotos/story/...` (same-origin),
 * evitando erro de CORS e contaminação do `<canvas>` ao exportar PNG.
 */
export function resolvePromoPhotoSrc(
  vehicle: Pick<PromoVehicle, "id" | "photos">,
  photoIndex = 0,
): string {
  if (!vehicle) return "";
  const chosen =
    vehicle.photos?.[photoIndex]?.url?.trim() ||
    vehicle.photos?.[0]?.url?.trim() ||
    "";
  if (!chosen) return "";
  if (
    (chosen.startsWith("/") && !chosen.startsWith("//")) ||
    chosen.startsWith("data:") ||
    chosen.startsWith("blob:")
  ) {
    return chosen;
  }
  const params = new URLSearchParams({ url: chosen });
  return `/api/fotos/story/${encodeURIComponent(vehicle.id)}?${params.toString()}`;
}

export const resolveStoryPhotoSrc = resolvePromoPhotoSrc;

/**
 * Calcula o enquadramento 4:3: se a imagem original não estiver em 4:3,
 * preenche o fundo com a própria foto ampliada e desfocada (sem barras pretas)
 * e centraliza a foto nítida inteira (`contain`) em primeiro plano sem cortar.
 */
export function computePhotoBox4x3Layout(
  imgWidth: number,
  imgHeight: number,
  box: PhotoPlacement = STORY_PHOTO_BOX,
): StoryPhotoLayout {
  const safeW = Math.max(1, imgWidth);
  const safeH = Math.max(1, imgHeight);
  const imgRatio = safeW / safeH;
  const boxRatio = box.width / box.height;
  const needsBlurredBackdrop = Math.abs(imgRatio - boxRatio) > 0.02;

  const coverScale =
    Math.max(box.width / safeW, box.height / safeH) *
    (needsBlurredBackdrop ? 1.08 : 1);
  const backdropW = safeW * coverScale;
  const backdropH = safeH * coverScale;
  const backdrop: PhotoPlacement = {
    x: box.x + (box.width - backdropW) / 2,
    y: box.y + (box.height - backdropH) / 2,
    width: backdropW,
    height: backdropH,
  };

  if (!needsBlurredBackdrop) {
    return {
      box,
      needsBlurredBackdrop: false,
      backdrop,
      foreground: backdrop,
    };
  }

  const containScale = Math.min(box.width / safeW, box.height / safeH);
  const fgW = safeW * containScale;
  const fgH = safeH * containScale;
  const foreground: PhotoPlacement = {
    x: box.x + (box.width - fgW) / 2,
    y: box.y + (box.height - fgH) / 2,
    width: fgW,
    height: fgH,
  };

  return {
    box,
    needsBlurredBackdrop: true,
    backdrop,
    foreground,
  };
}

export const computeStoryPhotoLayout = computePhotoBox4x3Layout;

/**
 * Calcula o posicionamento proporcional (`contain`) de um ativo gráfico (como o
 * logo real da Garagem) sem achatar ou esticar a imagem.
 */
export function computeProportionalPlacement(
  imgWidth: number,
  imgHeight: number,
  targetBox: PhotoPlacement,
  align: "left" | "center" | "right" = "center",
): PhotoPlacement {
  const safeW = Math.max(1, imgWidth);
  const safeH = Math.max(1, imgHeight);
  const scale = Math.min(targetBox.width / safeW, targetBox.height / safeH);
  const width = safeW * scale;
  const height = safeH * scale;
  let x = targetBox.x + (targetBox.width - width) / 2;
  if (align === "left") x = targetBox.x;
  if (align === "right") x = targetBox.x + targetBox.width - width;
  const y = targetBox.y + (targetBox.height - height) / 2;
  return { x, y, width, height };
}

/**
 * Geometria de selo circular: garante sempre um círculo perfeito (`width === height`
 * e raio único `radius`) caso um emblema seja aplicado em selo.
 */
export function computePerfectCircleSeal(
  cx: number,
  cy: number,
  diameter: number,
  paddingRatio = 0.16,
): SealCircleLayout {
  const safeDiameter = Math.max(2, diameter);
  const radius = safeDiameter / 2;
  const innerSize = safeDiameter * Math.max(0.2, 1 - paddingRatio * 2);
  return {
    cx,
    cy,
    radius,
    width: safeDiameter,
    height: safeDiameter,
    innerBox: {
      x: cx - innerSize / 2,
      y: cy - innerSize / 2,
      width: innerSize,
      height: innerSize,
    },
  };
}

function parseAccessories(raw?: string[] | string | null): string[] {
  let list: string[] = [];
  if (Array.isArray(raw)) {
    list = raw.map(String);
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.map(String);
    } catch {
      list = [];
    }
  }
  return list.map((item) => sanitizePromoText(item)).filter(Boolean);
}

export function buildPromoFileName(
  vehicle: VehiclePathInput,
  kind: PromoArtKind,
): string {
  const slug = vehicleSlug(vehicle);
  const spec = PROMO_ART_SPECS[kind];
  return `${slug}-${spec.fileSuffix}.png`;
}

export function buildPromoZipFileName(vehicle: VehiclePathInput): string {
  return `kit-divulgacao-${vehicleSlug(vehicle)}.zip`;
}

export function buildWhatsAppPromo(
  vehicle: PromoVehicle,
  siteOrigin = site.url,
): string {
  const isSold = vehicle.status === "vendido";
  const cleanBrand = sanitizePromoText(vehicle.brand);
  const cleanModel = sanitizePromoText(vehicle.model);
  const cleanVersion = sanitizePromoText(vehicle.version);
  const title = [cleanBrand, cleanModel, cleanVersion]
    .filter(Boolean)
    .join(" ");
  const yearText = formatPromoYear(vehicle);
  const kmText = formatPromoKm(vehicle.km);
  const transmission = resolvePromoTransmission(
    vehicle.version,
    vehicle.transmission,
  );
  const url = `${siteOrigin.replace(/\/$/, "")}${vehiclePath(vehicle)}`;

  const lines = [
    `🚗 *${title}*`,
    `📅 Ano: ${yearText}`,
    `🛣️ KM: ${kmText}`,
    ...(transmission ? [`⚙️ Câmbio: ${transmission}`] : []),
    ...(!isSold
      ? [`💰 À vista: *${formatCurrencyBRL(vehicle.price)}*`]
      : [`🏷️ *Veículo vendido*`]),
    "",
    `✅ Aceitamos troca · Financiamos`,
    `📍 ${PROMO_SERVICE_AREAS_TEXT}`,
    `📲 ${PROMO_APPOINTMENT_TEXT}: ${site.whatsappLabel}`,
    `🔗 Veja as fotos e a ficha completa: ${url}`,
  ];

  return lines.join("\n");
}

export function buildInstagramPromo(
  vehicle: PromoVehicle,
  siteOrigin = site.url,
): string {
  const isSold = vehicle.status === "vendido";
  const cleanBrand = sanitizePromoText(vehicle.brand);
  const cleanModel = sanitizePromoText(vehicle.model);
  const cleanVersion = sanitizePromoText(vehicle.version);
  const title = [cleanBrand, cleanModel, cleanVersion]
    .filter(Boolean)
    .join(" ");
  const yearText = formatPromoYear(vehicle);
  const kmText = formatPromoKm(vehicle.km);
  const transmission = resolvePromoTransmission(
    vehicle.version,
    vehicle.transmission,
  );
  const accessories = parseAccessories(vehicle.accessories).slice(0, 4);

  const modelTag = formatPromoTag(vehicle.model);
  const brandTag = formatPromoTag(vehicle.brand);
  const domain =
    siteOrigin.replace(/^https?:\/\//, "").replace(/\/$/, "") ||
    PROMO_DOMAIN_TEXT;

  const hashtags = [
    "#garagem",
    ...(modelTag ? [`#${modelTag}`] : []),
    "#linhares",
    "#vitoria",
    "#aracruz",
    "#grandevitoria",
    ...(brandTag && brandTag !== modelTag ? [`#${brandTag}`] : []),
    "#seminovos",
  ].join(" ");

  const lines = [
    `${title} — ${yearText}`,
    "",
    ...(!isSold
      ? [`💰 ${formatCurrencyBRL(vehicle.price)} à vista`]
      : ["🏷️ Veículo vendido"]),
    `• Ano: ${yearText}`,
    `• KM: ${kmText}`,
    ...(transmission ? [`• Câmbio: ${transmission}`] : []),
    ...accessories.map((item) => `• ${item}`),
    "",
    "Aceitamos troca e financiamos.",
    `${PROMO_SERVICE_AREAS_TEXT}. ${PROMO_APPOINTMENT_TEXT}: ${site.whatsappLabel}.`,
    `Confira no site: ${domain}`,
    "",
    hashtags,
  ];

  return lines.join("\n");
}

export type PromoRenderOptions = {
  photoImg?: PromoImageSource | null;
  logoImg?: PromoImageSource | null;
  titleFontFamily?: string;
  displayFontFamily?: string;
  bodyFontFamily?: string;
  /** Mantido para compatibilidade com chamadas antigas. */
  fontFamily?: string;
};

function resolvePromoFonts(options?: PromoRenderOptions) {
  const titleFamily = options?.titleFontFamily?.trim()
    ? options.titleFontFamily.trim()
    : '"Barlow Condensed", "Sora", sans-serif';
  const legacyDisplay = options?.fontFamily?.trim();
  const displayFamily = options?.displayFontFamily?.trim()
    ? options.displayFontFamily.trim()
    : legacyDisplay
      ? legacyDisplay.includes("Sora")
        ? legacyDisplay
        : `${legacyDisplay}, "Sora", sans-serif`
      : '"Sora", sans-serif';
  const bodyFamily = options?.bodyFontFamily?.trim()
    ? options.bodyFontFamily.trim()
    : '"Inter", "Sora", sans-serif';
  return { titleFamily, displayFamily, bodyFamily };
}

function fitFontSize(
  ctx: PromoCanvasContext2D,
  text: string,
  maxWidth: number,
  initialPx: number,
  minPx: number,
  fontBuilder: (px: number) => string,
): string {
  let size = initialPx;
  ctx.font = fontBuilder(size);
  if (!ctx.measureText) return ctx.font;

  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = fontBuilder(size);
  }
  return ctx.font;
}

function drawDiagonalSlash(
  ctx: PromoCanvasContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  slant: number,
  color: string,
) {
  ctx.fillStyle = color;
  if (ctx.moveTo && ctx.lineTo && ctx.closePath && ctx.fill) {
    ctx.beginPath();
    ctx.moveTo(x + slant, y);
    ctx.lineTo(x + width + slant, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillRect(x, y, width, height);
  }
}

function drawBrandLogo(
  ctx: PromoCanvasContext2D,
  logoImg: PromoImageSource | null | undefined,
  box: PhotoPlacement,
  align: "left" | "center" = "center",
) {
  if (
    logoImg &&
    logoImg.complete !== false &&
    logoImg.naturalWidth > 0 &&
    logoImg.naturalHeight > 0
  ) {
    const isSquareSeal =
      Math.abs(logoImg.naturalWidth / logoImg.naturalHeight - 1) < 0.05 &&
      Math.abs(box.width / box.height - 1) < 0.05;

    if (isSquareSeal && ctx.arc) {
      const diameter = Math.min(box.width, box.height);
      const seal = computePerfectCircleSeal(
        box.x + box.width / 2,
        box.y + box.height / 2,
        diameter,
      );
      ctx.save();
      ctx.beginPath();
      ctx.arc(seal.cx, seal.cy, seal.radius, 0, Math.PI * 2);
      if (ctx.fill) {
        ctx.fillStyle = PROMO_SURFACE_DARK;
        ctx.fill();
      }
      ctx.clip();
      const placed = computeProportionalPlacement(
        logoImg.naturalWidth,
        logoImg.naturalHeight,
        seal.innerBox,
        "center",
      );
      ctx.drawImage(
        logoImg as HTMLImageElement,
        placed.x,
        placed.y,
        placed.width,
        placed.height,
      );
      ctx.restore();
      return;
    }

    const placed = computeProportionalPlacement(
      logoImg.naturalWidth,
      logoImg.naturalHeight,
      box,
      align,
    );
    ctx.drawImage(
      logoImg as HTMLImageElement,
      placed.x,
      placed.y,
      placed.width,
      placed.height,
    );
  }
}

function drawPhotoFrame4x3(
  ctx: PromoCanvasContext2D,
  photoBox: PhotoPlacement,
  photoImg: PromoImageSource | null | undefined,
  bodyFamily: string,
) {
  const { x: photoX, y: photoY, width: photoW, height: photoH } = photoBox;

  // Base escura do quadro 4:3
  ctx.fillStyle = PROMO_SURFACE_DARK;
  ctx.fillRect(photoX, photoY, photoW, photoH);

  if (
    photoImg &&
    photoImg.complete !== false &&
    photoImg.naturalWidth > 0 &&
    photoImg.naturalHeight > 0
  ) {
    const layout = computePhotoBox4x3Layout(
      photoImg.naturalWidth,
      photoImg.naturalHeight,
      photoBox,
    );

    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();

    if (layout.needsBlurredBackdrop) {
      ctx.save();
      ctx.filter = "blur(28px) brightness(0.72)";
      ctx.drawImage(
        photoImg as HTMLImageElement,
        layout.backdrop.x,
        layout.backdrop.y,
        layout.backdrop.width,
        layout.backdrop.height,
      );
      ctx.restore();

      ctx.fillStyle = "rgba(13, 13, 15, 0.20)";
      ctx.fillRect(photoX, photoY, photoW, photoH);
    }

    // Foto principal sem filtro: preserva 100% as cores originais e a placa
    ctx.filter = "none";
    ctx.drawImage(
      photoImg as HTMLImageElement,
      layout.foreground.x,
      layout.foreground.y,
      layout.foreground.width,
      layout.foreground.height,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = "#A1A1AA";
    ctx.font = `600 28px ${bodyFamily}`;
    ctx.textAlign = "center";
    ctx.fillText("Foto do veículo", photoX + photoW / 2, photoY + photoH / 2);
  }

  // Moldura externa discreta + filete vermelho inferior fora da área da foto
  if (ctx.strokeRect) {
    ctx.strokeStyle = PROMO_BORDER_DARK;
    ctx.lineWidth = 2;
    ctx.strokeRect(photoX, photoY, photoW, photoH);
  }
  ctx.fillStyle = PROMO_BRAND_RED;
  ctx.fillRect(photoX, photoY + photoH, photoW, 6);
}

function drawSpecsRow(
  ctx: PromoCanvasContext2D,
  specs: Array<{ label: string; value: string }>,
  rowBox: PhotoPlacement,
  displayFamily: string,
  bodyFamily: string,
) {
  const count = Math.max(1, specs.length);
  const gap = 18;
  const cardWidth = (rowBox.width - gap * (count - 1)) / count;

  specs.forEach((spec, idx) => {
    const cx = rowBox.x + idx * (cardWidth + gap);
    ctx.fillStyle = PROMO_SURFACE_DARK;
    ctx.fillRect(cx, rowBox.y, cardWidth, rowBox.height);
    if (ctx.strokeRect) {
      ctx.strokeStyle = PROMO_BORDER_DARK;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, rowBox.y, cardWidth, rowBox.height);
    }
    // Detalhe lateral vermelho sólido
    ctx.fillStyle = PROMO_BRAND_RED;
    ctx.fillRect(cx, rowBox.y, 6, rowBox.height);

    ctx.textAlign = "left";
    ctx.fillStyle = "#A1A1AA";
    ctx.font = `600 18px ${bodyFamily}`;
    ctx.fillText(spec.label, cx + 22, rowBox.y + 34, cardWidth - 36);

    ctx.fillStyle = "#FFFFFF";
    fitFontSize(
      ctx,
      spec.value,
      cardWidth - 36,
      30,
      20,
      (px) => `700 ${px}px ${displayFamily}`,
    );
    ctx.fillText(
      spec.value,
      cx + 22,
      rowBox.y + rowBox.height - 20,
      cardWidth - 36,
    );
  });
}

function drawPriceBlock(
  ctx: PromoCanvasContext2D,
  vehicle: PromoVehicle,
  box: PhotoPlacement,
  titleFamily: string,
  displayFamily: string,
  bodyFamily: string,
  layout: "wide" | "compact" = "wide",
) {
  const isSold = vehicle.status === "vendido";

  if (isSold) {
    ctx.fillStyle = "#27272A";
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.fillStyle = PROMO_BRAND_RED;
    ctx.fillRect(box.x, box.y, 10, box.height);

    ctx.textAlign = "center";
    ctx.fillStyle = "#F7F5F2";
    ctx.font = `italic 800 ${layout === "wide" ? 56 : 50}px ${titleFamily}`;
    ctx.fillText(
      "VENDIDO",
      box.x + box.width / 2,
      box.y + box.height / 2 + 19,
      box.width - 40,
    );
    return;
  }

  ctx.fillStyle = PROMO_BRAND_RED;
  ctx.fillRect(box.x, box.y, box.width, box.height);

  // Detalhe geométrico automotivo no canto direito em vermelho escuro
  drawDiagonalSlash(
    ctx,
    box.x + box.width - 96,
    box.y,
    56,
    box.height,
    24,
    PROMO_BRAND_RED_DARK,
  );

  const priceStr = formatCurrencyBRL(vehicle.price);

  if (layout === "wide") {
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFE4E4";
    ctx.font = `700 20px ${bodyFamily}`;
    ctx.fillText("PREÇO À VISTA", box.x + 34, box.y + box.height / 2 + 7);

    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    fitFontSize(
      ctx,
      priceStr,
      box.width - 250,
      56,
      36,
      (px) => `700 ${px}px ${displayFamily}`,
    );
    ctx.fillText(
      priceStr,
      box.x + box.width - 36,
      box.y + box.height / 2 + 19,
      box.width - 250,
    );
  } else {
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFE4E4";
    ctx.font = `700 18px ${bodyFamily}`;
    ctx.fillText("PREÇO À VISTA", box.x + 26, box.y + 38);

    ctx.fillStyle = "#FFFFFF";
    fitFontSize(
      ctx,
      priceStr,
      box.width - 52,
      48,
      30,
      (px) => `700 ${px}px ${displayFamily}`,
    );
    ctx.fillText(
      priceStr,
      box.x + 26,
      box.y + box.height - 26,
      box.width - 52,
    );
  }
}

export function renderPromoArt(
  ctx: PromoCanvasContext2D,
  vehicle: PromoVehicle,
  kind: PromoArtKind,
  options?: PromoRenderOptions,
): void {
  const spec = PROMO_ART_SPECS[kind];
  const W = spec.width;
  const H = spec.height;
  const { titleFamily, displayFamily, bodyFamily } = resolvePromoFonts(options);

  const cleanBrand = sanitizePromoText(vehicle.brand).toLocaleUpperCase("pt-BR");
  const cleanModel = sanitizePromoText(vehicle.model).toLocaleUpperCase("pt-BR");
  const fullTitle = [cleanBrand, cleanModel].filter(Boolean).join(" ");
  const cleanVersion = sanitizePromoText(vehicle.version);
  const yearText = formatPromoYear(vehicle);
  const kmText = formatPromoKm(vehicle.km);
  const transmission = resolvePromoTransmission(
    vehicle.version,
    vehicle.transmission,
  );

  const specsList: Array<{ label: string; value: string }> = [
    { label: "ANO", value: yearText },
    { label: "KM", value: kmText },
    ...(transmission ? [{ label: "CÂMBIO", value: transmission }] : []),
  ];

  // Fundo principal preto asfalto
  ctx.filter = "none";
  ctx.fillStyle = PROMO_BG_DARK;
  ctx.fillRect(0, 0, W, H);

  if (kind === "feed") {
    // Topo: barra vermelha sólida + logo real centralizado
    ctx.fillStyle = PROMO_BRAND_RED;
    ctx.fillRect(0, 0, W, 10);
    drawDiagonalSlash(ctx, W - 180, 10, 70, 8, 12, PROMO_BRAND_RED_DARK);

    drawBrandLogo(
      ctx,
      options?.logoImg,
      { x: W / 2 - 165, y: 28, width: 330, height: 64 },
      "center",
    );

    // Quadro 4:3 (960×720)
    drawPhotoFrame4x3(ctx, spec.photoBox, options?.photoImg, bodyFamily);

    // Título em Barlow Condensed ExtraBold Italic
    const contentX = 60;
    const contentW = 960;
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    fitFontSize(
      ctx,
      fullTitle,
      contentW,
      68,
      40,
      (px) => `italic 800 ${px}px ${titleFamily}`,
    );
    ctx.fillText(fullTitle, contentX, 906, contentW);

    if (cleanVersion) {
      ctx.fillStyle = "#D4D4D8";
      fitFontSize(
        ctx,
        cleanVersion,
        contentW,
        27,
        19,
        (px) => `600 ${px}px ${bodyFamily}`,
      );
      ctx.fillText(cleanVersion, contentX, 948, contentW);
    }

    // Dados ANO / KM / CÂMBIO
    drawSpecsRow(
      ctx,
      specsList,
      { x: contentX, y: 972, width: contentW, height: 96 },
      displayFamily,
      bodyFamily,
    );

    // Preço à vista
    drawPriceBlock(
      ctx,
      vehicle,
      { x: contentX, y: 1088, width: contentW, height: 104 },
      titleFamily,
      displayFamily,
      bodyFamily,
      "wide",
    );

    // Rodapé institucional
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 24px ${displayFamily}`;
    ctx.fillText(PROMO_TRADE_FINANCE_TEXT, W / 2, 1242, contentW);

    ctx.fillStyle = "#D4D4D8";
    ctx.font = `600 21px ${bodyFamily}`;
    ctx.fillText(PROMO_SERVICE_AREAS_TEXT, W / 2, 1280, contentW);

    ctx.fillStyle = "#A1A1AA";
    ctx.font = `500 20px ${bodyFamily}`;
    ctx.fillText(
      `${PROMO_DOMAIN_TEXT}  ·  WhatsApp ${site.whatsappLabel}`,
      W / 2,
      1314,
      contentW,
    );
    return;
  }

  if (kind === "story") {
    // Zonas de respiro superior (< 240) e inferior (> 1660) com textura sutil
    ctx.fillStyle = "#121216";
    ctx.fillRect(0, 0, W, 224);
    ctx.fillRect(0, 1676, W, H - 1676);

    ctx.fillStyle = PROMO_BRAND_RED;
    ctx.fillRect(60, 224, 960, 6);
    ctx.fillRect(60, 1670, 960, 6);

    // Logo real dentro da safe zone (y = 248..318)
    drawBrandLogo(
      ctx,
      options?.logoImg,
      { x: W / 2 - 185, y: 248, width: 370, height: 70 },
      "center",
    );

    // Quadro 4:3 (960×720) em y = 340..1060
    drawPhotoFrame4x3(ctx, spec.photoBox, options?.photoImg, bodyFamily);

    const contentX = 60;
    const contentW = 960;

    // Título em Barlow Condensed ExtraBold Italic
    ctx.textAlign = "left";
    ctx.fillStyle = "#FFFFFF";
    fitFontSize(
      ctx,
      fullTitle,
      contentW,
      74,
      42,
      (px) => `italic 800 ${px}px ${titleFamily}`,
    );
    ctx.fillText(fullTitle, contentX, 1146, contentW);

    if (cleanVersion) {
      ctx.fillStyle = "#D4D4D8";
      fitFontSize(
        ctx,
        cleanVersion,
        contentW,
        29,
        20,
        (px) => `600 ${px}px ${bodyFamily}`,
      );
      ctx.fillText(cleanVersion, contentX, 1192, contentW);
    }

    // Dados ANO / KM / CÂMBIO
    drawSpecsRow(
      ctx,
      specsList,
      { x: contentX, y: 1220, width: contentW, height: 104 },
      displayFamily,
      bodyFamily,
    );

    // Preço à vista
    drawPriceBlock(
      ctx,
      vehicle,
      { x: contentX, y: 1348, width: contentW, height: 116 },
      titleFamily,
      displayFamily,
      bodyFamily,
      "wide",
    );

    // Rodapé dentro da safe zone (<= 1650)
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 27px ${displayFamily}`;
    ctx.fillText(PROMO_TRADE_FINANCE_TEXT, W / 2, 1526, contentW);

    ctx.fillStyle = "#D4D4D8";
    ctx.font = `600 23px ${bodyFamily}`;
    ctx.fillText(PROMO_SERVICE_AREAS_TEXT, W / 2, 1574, contentW);

    ctx.fillStyle = "#A1A1AA";
    ctx.font = `500 21px ${bodyFamily}`;
    ctx.fillText(
      `${PROMO_DOMAIN_TEXT}  ·  WhatsApp ${site.whatsappLabel}`,
      W / 2,
      1618,
      contentW,
    );
    return;
  }

  // CAPA 1440×1080 (4:3 editorial de duas colunas)
  ctx.fillStyle = PROMO_BRAND_RED;
  ctx.fillRect(0, 0, W, 10);

  // Cabeçalho: logo à esquerda + contato à direita
  drawBrandLogo(
    ctx,
    options?.logoImg,
    { x: 56, y: 34, width: 310, height: 60 },
    "left",
  );

  ctx.textAlign = "right";
  ctx.fillStyle = "#D4D4D8";
  ctx.font = `600 22px ${bodyFamily}`;
  ctx.fillText(
    `${PROMO_DOMAIN_TEXT}  ·  WhatsApp ${site.whatsappLabel}`,
    W - 56,
    72,
    760,
  );

  // Coluna esquerda: foto 4:3 (880×660) 100% livre de sobreposições
  drawPhotoFrame4x3(ctx, spec.photoBox, options?.photoImg, bodyFamily);

  // Coluna direita: x = 968, width = 416
  const colX = 968;
  const colW = 416;

  ctx.fillStyle = PROMO_BRAND_RED;
  ctx.fillRect(colX, 126, 68, 8);

  ctx.textAlign = "left";
  ctx.fillStyle = "#D4D4D8";
  fitFontSize(
    ctx,
    cleanBrand,
    colW,
    38,
    24,
    (px) => `italic 800 ${px}px ${titleFamily}`,
  );
  ctx.fillText(cleanBrand, colX, 176, colW);

  ctx.fillStyle = "#FFFFFF";
  fitFontSize(
    ctx,
    cleanModel,
    colW,
    68,
    38,
    (px) => `italic 800 ${px}px ${titleFamily}`,
  );
  ctx.fillText(cleanModel, colX, 244, colW);

  if (cleanVersion) {
    ctx.fillStyle = "#D4D4D8";
    fitFontSize(
      ctx,
      cleanVersion,
      colW,
      24,
      18,
      (px) => `600 ${px}px ${bodyFamily}`,
    );
    ctx.fillText(cleanVersion, colX, 286, colW);
  }

  // Blocos verticais de ANO / KM / CÂMBIO na coluna direita
  const specStartY = 320;
  const specGap = 14;
  const specH = specsList.length === 3 ? 88 : 110;
  specsList.forEach((item, idx) => {
    const sy = specStartY + idx * (specH + specGap);
    ctx.fillStyle = PROMO_SURFACE_DARK;
    ctx.fillRect(colX, sy, colW, specH);
    if (ctx.strokeRect) {
      ctx.strokeStyle = PROMO_BORDER_DARK;
      ctx.lineWidth = 2;
      ctx.strokeRect(colX, sy, colW, specH);
    }
    ctx.fillStyle = PROMO_BRAND_RED;
    ctx.fillRect(colX, sy, 6, specH);

    ctx.textAlign = "left";
    ctx.fillStyle = "#A1A1AA";
    ctx.font = `600 18px ${bodyFamily}`;
    ctx.fillText(item.label, colX + 22, sy + specH / 2 + 6);

    ctx.textAlign = "right";
    ctx.fillStyle = "#FFFFFF";
    fitFontSize(
      ctx,
      item.value,
      colW - 150,
      30,
      20,
      (px) => `700 ${px}px ${displayFamily}`,
    );
    ctx.fillText(
      item.value,
      colX + colW - 22,
      sy + specH / 2 + 10,
      colW - 150,
    );
  });

  // Preço à vista na base da coluna direita (y = 654..786)
  drawPriceBlock(
    ctx,
    vehicle,
    { x: colX, y: 654, width: colW, height: 132 },
    titleFamily,
    displayFamily,
    bodyFamily,
    "compact",
  );

  // Rodapé institucional horizontal (x = 56..1384)
  const footerX = 56;
  const footerW = W - 112;
  ctx.fillStyle = PROMO_SURFACE_DARK;
  ctx.fillRect(footerX, 824, footerW, 86);
  ctx.fillStyle = PROMO_BRAND_RED;
  ctx.fillRect(footerX, 824, 10, 86);

  ctx.textAlign = "center";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 30px ${displayFamily}`;
  ctx.fillText(PROMO_TRADE_FINANCE_TEXT, W / 2, 878, footerW - 48);

  ctx.fillStyle = "#D4D4D8";
  ctx.font = `600 24px ${bodyFamily}`;
  ctx.fillText(
    `${PROMO_SERVICE_AREAS_TEXT}  ·  ${PROMO_DOMAIN_TEXT}`,
    W / 2,
    964,
    footerW,
  );

  ctx.fillStyle = "#A1A1AA";
  ctx.font = `500 21px ${bodyFamily}`;
  ctx.fillText(
    `${PROMO_APPOINTMENT_TEXT}  ·  ${site.whatsappLabel}`,
    W / 2,
    1006,
    footerW,
  );
}

export function renderFeedCard(
  ctx: PromoCanvasContext2D,
  vehicle: PromoVehicle,
  options?: PromoRenderOptions,
): void {
  renderPromoArt(ctx, vehicle, "feed", options);
}

export function renderStoryCard(
  ctx: PromoCanvasContext2D,
  vehicle: PromoVehicle,
  options?: PromoRenderOptions,
): void {
  renderPromoArt(ctx, vehicle, "story", options);
}

export function renderCoverCard(
  ctx: PromoCanvasContext2D,
  vehicle: PromoVehicle,
  options?: PromoRenderOptions,
): void {
  renderPromoArt(ctx, vehicle, "cover", options);
}

// ============================================================================
// Empacotador ZIP local (PKZIP Store — sem dependências externas)
// ============================================================================

export type ZipEntryInput = {
  name: string;
  data: Uint8Array;
};

let crcTableCache: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
  if (crcTableCache) return crcTableCache;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  crcTableCache = table;
  return table;
}

export function crc32(bytes: Uint8Array): number {
  const table = getCrc32Table();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Empacota arquivos já comprimidos (PNG) num arquivo `.zip` padrão (método 0 =
 * STORE, UTF-8), 100% no navegador e sem bibliotecas externas.
 */
export function buildZipArchive(entries: readonly ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => {
    const safeName = entry.name.replace(/^[/\\]+/, "");
    const nameBytes = encoder.encode(safeName);
    const data = entry.data;
    const checksum = crc32(data);
    return { nameBytes, data, checksum };
  });

  let localTotal = 0;
  let centralTotal = 0;
  for (const item of prepared) {
    localTotal += 30 + item.nameBytes.length + item.data.length;
    centralTotal += 46 + item.nameBytes.length;
  }

  const totalSize = localTotal + centralTotal + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  // Data/hora DOS estável (2026-01-01 12:00:00)
  const dosTime = (12 << 11) | (0 << 5) | 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const utf8Flag = 0x0800;

  const offsets: number[] = [];
  let offset = 0;

  for (const item of prepared) {
    offsets.push(offset);
    // Local file header signature (0x04034b50)
    view.setUint32(offset, 0x04034b50, true);
    view.setUint16(offset + 4, 20, true); // version needed (2.0)
    view.setUint16(offset + 6, utf8Flag, true);
    view.setUint16(offset + 8, 0, true); // compression method: 0 = STORE
    view.setUint16(offset + 10, dosTime, true);
    view.setUint16(offset + 12, dosDate, true);
    view.setUint32(offset + 14, item.checksum, true);
    view.setUint32(offset + 18, item.data.length, true);
    view.setUint32(offset + 22, item.data.length, true);
    view.setUint16(offset + 26, item.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true);
    out.set(item.nameBytes, offset + 30);
    out.set(item.data, offset + 30 + item.nameBytes.length);
    offset += 30 + item.nameBytes.length + item.data.length;
  }

  const centralStart = offset;
  prepared.forEach((item, idx) => {
    // Central directory file header signature (0x02014b50)
    view.setUint32(offset, 0x02014b50, true);
    view.setUint16(offset + 4, 20, true); // version made by
    view.setUint16(offset + 6, 20, true); // version needed
    view.setUint16(offset + 8, utf8Flag, true);
    view.setUint16(offset + 10, 0, true); // STORE
    view.setUint16(offset + 12, dosTime, true);
    view.setUint16(offset + 14, dosDate, true);
    view.setUint32(offset + 16, item.checksum, true);
    view.setUint32(offset + 20, item.data.length, true);
    view.setUint32(offset + 24, item.data.length, true);
    view.setUint16(offset + 28, item.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true); // extra len
    view.setUint16(offset + 32, 0, true); // comment len
    view.setUint16(offset + 34, 0, true); // disk start
    view.setUint16(offset + 36, 0, true); // internal attrs
    view.setUint32(offset + 38, 0, true); // external attrs
    view.setUint32(offset + 42, offsets[idx], true); // local header offset
    out.set(item.nameBytes, offset + 46);
    offset += 46 + item.nameBytes.length;
  });

  const centralSize = offset - centralStart;
  // End of central directory record (0x06054b50)
  view.setUint32(offset, 0x06054b50, true);
  view.setUint16(offset + 4, 0, true);
  view.setUint16(offset + 6, 0, true);
  view.setUint16(offset + 8, prepared.length, true);
  view.setUint16(offset + 10, prepared.length, true);
  view.setUint32(offset + 12, centralSize, true);
  view.setUint32(offset + 16, centralStart, true);
  view.setUint16(offset + 20, 0, true);

  return out;
}
