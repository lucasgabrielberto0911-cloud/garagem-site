import { formatCurrencyBRL, formatNumberBR } from "@/lib/format";
import { site } from "@/lib/site";
import { resolveTransmission } from "@/lib/vehicle-display";
import { vehiclePath, type VehiclePathInput } from "@/lib/vehicle-slug";

export const CONSIGNED_PROMO_BLOCKED_MESSAGE =
  "Consignado: kit de divulgação disponível apenas para veículos do estoque próprio.";

export const PROMO_SERVICE_AREAS_TEXT =
  "Atendemos Linhares, Aracruz e Grande Vitória";

export const PROMO_APPOINTMENT_TEXT =
  "Combinamos o atendimento pelo WhatsApp";

export const STORY_CARD_WIDTH = 1080;
export const STORY_CARD_HEIGHT = 1920;

/** Quadro 4:3 (960×720) no card vertical 1080×1920. */
export const STORY_PHOTO_BOX = {
  x: 60,
  y: 210,
  width: 960,
  height: 720,
} as const;

export type PromoVehicle = VehiclePathInput & {
  year: number;
  km: number;
  transmission?: string | null;
  fuel?: string | null;
  color?: string | null;
  price: number;
  status: string;
  consigned?: boolean | null;
  accessories?: string[] | string | null;
  photos?: Array<{ id?: string; url: string; thumbnailUrl?: string | null }>;
};

export type PhotoPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StoryPhotoLayout = {
  box: PhotoPlacement;
  needsBlurredBackdrop: boolean;
  backdrop: PhotoPlacement;
  foreground: PhotoPlacement;
};

export type StoryImageSource = {
  complete?: boolean;
  naturalWidth: number;
  naturalHeight: number;
};

export type StoryCanvasContext2D = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "font"
  | "textAlign"
  | "fillRect"
  | "fillText"
  | "createLinearGradient"
  | "save"
  | "restore"
  | "beginPath"
  | "rect"
  | "clip"
> & {
  filter?: string;
  drawImage(
    image: HTMLImageElement,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
};

export function canUseVehiclePromoKit(
  vehicle: { consigned?: boolean | null } | null | undefined,
): boolean {
  return Boolean(vehicle) && vehicle?.consigned !== true;
}

function assertOwnStockForPromo(vehicle: { consigned?: boolean | null }) {
  if (!canUseVehiclePromoKit(vehicle)) {
    throw new Error(CONSIGNED_PROMO_BLOCKED_MESSAGE);
  }
}

/**
 * Converte a capa para rota local `/api/fotos/story/...` (same-origin),
 * evitando falha de CORS e contaminação do `<canvas>` ao exportar PNG.
 */
export function resolveStoryPhotoSrc(
  vehicle: Pick<PromoVehicle, "id" | "photos" | "consigned">,
): string {
  if (!canUseVehiclePromoKit(vehicle)) return "";
  const raw = vehicle.photos?.[0]?.url?.trim() ?? "";
  if (!raw) return "";
  if (
    (raw.startsWith("/") && !raw.startsWith("//")) ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }
  const params = new URLSearchParams({ url: raw });
  return `/api/fotos/story/${encodeURIComponent(vehicle.id)}?${params.toString()}`;
}

/**
 * Calcula o enquadramento 4:3 (`960×720`): se a imagem original não estiver
 * em 4:3, preenche o fundo com a própria foto ampliada e desfocada (sem barras
 * pretas) e centraliza a foto nítida inteira (`contain`) em primeiro plano.
 */
export function computeStoryPhotoLayout(
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

function parseAccessories(raw?: string[] | string | null): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

export function buildWhatsAppPromo(
  vehicle: PromoVehicle,
  siteOrigin = site.url,
): string {
  assertOwnStockForPromo(vehicle);

  const isSold = vehicle.status === "vendido";
  const title = [vehicle.brand, vehicle.model, vehicle.version]
    .filter(Boolean)
    .join(" ");
  const yearText =
    vehicle.year === vehicle.yearModel
      ? `${vehicle.year}`
      : `${vehicle.year}/${vehicle.yearModel}`;
  const kmText = `${formatNumberBR(vehicle.km)} km`;
  const url = `${siteOrigin}${vehiclePath(vehicle)}`;
  const normalizedTransmission = resolveTransmission(
    vehicle.version,
    vehicle.transmission,
  );

  const accessories = parseAccessories(vehicle.accessories);
  const highlights = accessories.slice(0, 4).join(" · ");

  const gearFuel = [
    normalizedTransmission ? `Câmbio: ${normalizedTransmission}` : "",
    vehicle.fuel,
  ]
    .filter(Boolean)
    .join(" · ");

  const lines = [
    `🚗 *${title}*`,
    `📅 Ano: ${yearText}`,
    `📍 KM: ${kmText}`,
    ...(gearFuel ? [`⚙️ ${gearFuel}`] : []),
  ];

  if (vehicle.color) {
    lines.push(`🎨 Cor: ${vehicle.color}`);
  }

  if (highlights) {
    lines.push(`✨ Destaques: ${highlights}`);
  }

  if (!isSold) {
    lines.push(`💰 Valor: ${formatCurrencyBRL(vehicle.price)}`);
  } else {
    lines.push(`🏷️ Veículo vendido`);
  }

  lines.push(`🔗 Confira fotos e ficha completa: ${url}`);
  lines.push(`📲 WhatsApp: ${site.whatsappLabel}`);
  lines.push("");
  lines.push(`Garagem · ${PROMO_SERVICE_AREAS_TEXT}`);

  return lines.join("\n");
}

export function buildInstagramPromo(
  vehicle: PromoVehicle,
  siteOrigin = site.url,
): string {
  assertOwnStockForPromo(vehicle);

  const isSold = vehicle.status === "vendido";
  const title = [vehicle.brand, vehicle.model, vehicle.version]
    .filter(Boolean)
    .join(" ");
  const yearText =
    vehicle.year === vehicle.yearModel
      ? `${vehicle.year}`
      : `${vehicle.year}/${vehicle.yearModel}`;
  const kmText = `${formatNumberBR(vehicle.km)} km`;
  const normalizedTransmission = resolveTransmission(
    vehicle.version,
    vehicle.transmission,
  );
  const accessories = parseAccessories(vehicle.accessories);

  const brandTag = vehicle.brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  const modelTag = vehicle.model.toLowerCase().replace(/[^a-z0-9]/g, "");

  const domain = siteOrigin.replace(/^https?:\/\//, "").replace(/\/$/, "");

  const lines = [
    `${title} — ${yearText}`,
    "",
    ...(!isSold ? [`🏷️ ${formatCurrencyBRL(vehicle.price)}`] : ["🏷️ Vendido"]),
    `• ${kmText}`,
    ...(normalizedTransmission ? [`• Câmbio ${normalizedTransmission}`] : []),
    ...(vehicle.fuel ? [`• ${vehicle.fuel}`] : []),
    ...(vehicle.color ? [`• Cor ${vehicle.color}`] : []),
    ...accessories.slice(0, 5).map((item) => `• ${item}`),
    "",
    "Garantia e procedência garantida na Garagem.",
    `📲 Chame no WhatsApp ${site.whatsappLabel} ou confira no site ${domain}!`,
    `📍 ${PROMO_SERVICE_AREAS_TEXT} · ${PROMO_APPOINTMENT_TEXT}.`,
    "",
    `#garagem #seminovos #linhares #aracruz #grandevitoria #carros #veiculos${brandTag ? ` #${brandTag}` : ""}${modelTag ? ` #${modelTag}` : ""}`,
  ];

  return lines.join("\n");
}

export function renderStoryCard(
  ctx: StoryCanvasContext2D,
  vehicle: PromoVehicle,
  options?: {
    photoImg?: StoryImageSource | null;
    fontFamily?: string;
  },
): void {
  assertOwnStockForPromo(vehicle);

  const W = STORY_CARD_WIDTH;
  const H = STORY_CARD_HEIGHT;
  const isSold = vehicle.status === "vendido";
  const rawFamily = options?.fontFamily?.trim() ?? "";
  const fontFamily = rawFamily
    ? rawFamily.includes("Sora")
      ? rawFamily
      : `${rawFamily}, "Sora", sans-serif`
    : '"Sora", sans-serif';

  // Fundo asphalt
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
  ctx.font = `700 56px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.fillText("GARAGEM", W / 2, 115);

  ctx.fillStyle = "#A1A1AA";
  ctx.font = `600 26px ${fontFamily}`;
  ctx.fillText("SEMINOVOS SELECIONADOS", W / 2, 162);

  // Quadro da foto em 4:3 (960×720)
  const { x: photoX, y: photoY, width: photoW, height: photoH } = STORY_PHOTO_BOX;
  ctx.fillStyle = "#18181B";
  ctx.fillRect(photoX, photoY, photoW, photoH);

  const photoImg = options?.photoImg;
  if (
    photoImg &&
    photoImg.complete !== false &&
    photoImg.naturalWidth > 0 &&
    photoImg.naturalHeight > 0
  ) {
    const layout = computeStoryPhotoLayout(
      photoImg.naturalWidth,
      photoImg.naturalHeight,
      STORY_PHOTO_BOX,
    );

    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, photoY, photoW, photoH);
    ctx.clip();

    if (layout.needsBlurredBackdrop) {
      ctx.save();
      ctx.filter = "blur(28px) brightness(0.75)";
      ctx.drawImage(
        photoImg as HTMLImageElement,
        layout.backdrop.x,
        layout.backdrop.y,
        layout.backdrop.width,
        layout.backdrop.height,
      );
      ctx.restore();

      ctx.fillStyle = "rgba(13, 13, 15, 0.22)";
      ctx.fillRect(photoX, photoY, photoW, photoH);
    }

    ctx.drawImage(
      photoImg as HTMLImageElement,
      layout.foreground.x,
      layout.foreground.y,
      layout.foreground.width,
      layout.foreground.height,
    );
    ctx.restore();
  }

  // Detalhes do veículo abaixo da foto 4:3
  const infoY = photoY + photoH + 90;
  const maxTextWidth = photoW;
  ctx.textAlign = "center";

  // Marca + Modelo
  ctx.fillStyle = "#F7F5F2";
  ctx.font = `700 62px ${fontFamily}`;
  const title = `${vehicle.brand} ${vehicle.model}`;
  ctx.fillText(title, W / 2, infoY, maxTextWidth);

  // Versão
  if (vehicle.version) {
    ctx.fillStyle = "#D4D4D8";
    ctx.font = `600 38px ${fontFamily}`;
    ctx.fillText(vehicle.version, W / 2, infoY + 62, maxTextWidth);
  }

  // Chips de dados (Ano, KM, Câmbio normalizado, Combustível)
  const yearText =
    vehicle.year === vehicle.yearModel
      ? `${vehicle.year}`
      : `${vehicle.year}/${vehicle.yearModel}`;
  const normalizedTransmission = resolveTransmission(
    vehicle.version,
    vehicle.transmission,
  );
  const chips = [
    `Ano ${yearText}`,
    `${formatNumberBR(vehicle.km)} km`,
    normalizedTransmission,
    vehicle.fuel,
  ].filter(Boolean);

  const chipY = infoY + 142;
  ctx.font = `600 32px ${fontFamily}`;
  ctx.fillStyle = "#A1A1AA";
  ctx.fillText(chips.join("  •  "), W / 2, chipY, maxTextWidth);

  // Bloco de Preço (nunca mostra valor quando vendido)
  const priceY = chipY + 125;
  if (!isSold) {
    ctx.fillStyle = "#E8181C";
    ctx.fillRect(W / 2 - 300, priceY - 64, 600, 108);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 54px ${fontFamily}`;
    ctx.fillText(formatCurrencyBRL(vehicle.price), W / 2, priceY + 12, 560);
  } else {
    ctx.fillStyle = "#27272A";
    ctx.fillRect(W / 2 - 240, priceY - 64, 480, 108);
    ctx.fillStyle = "#A1A1AA";
    ctx.font = `700 44px ${fontFamily}`;
    ctx.fillText("VENDIDO", W / 2, priceY + 10, 440);
  }

  // Rodapé institucional (WhatsApp da config + regiões atendidas)
  ctx.fillStyle = "#F7F5F2";
  ctx.font = `700 38px ${fontFamily}`;
  ctx.fillText(`WhatsApp ${site.whatsappLabel}`, W / 2, H - 230, maxTextWidth);

  ctx.fillStyle = "#D4D4D8";
  ctx.font = `600 30px ${fontFamily}`;
  ctx.fillText(PROMO_SERVICE_AREAS_TEXT, W / 2, H - 170, maxTextWidth);

  ctx.fillStyle = "#A1A1AA";
  ctx.font = `500 25px ${fontFamily}`;
  ctx.fillText(
    `suagaragem.net  •  ${PROMO_APPOINTMENT_TEXT}`,
    W / 2,
    H - 115,
    maxTextWidth,
  );
}
