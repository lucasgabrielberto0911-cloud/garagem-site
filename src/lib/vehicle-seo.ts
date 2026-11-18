import type { Metadata } from "next";
import { formatCurrencyBRL, formatVehicleLabel, vehicleSeoDescription } from "@/lib/format";
import { publicVehiclePhotoSrc } from "@/lib/public-photo-url";
import { absoluteHttpsUrl, absoluteUrl, pageCanonicalPath } from "@/lib/seo";
import { SEO_LOCAL_LOCATION } from "@/lib/seo-local";
import { formatVehicleDisplay, shortVersion } from "@/lib/vehicle-display";
import { site } from "@/lib/site";
import { vehiclePath } from "@/lib/vehicle-slug";

/** O Google corta títulos por volta de 60 caracteres. */
export const VEHICLE_SEO_TITLE_MAX = 60;

type VehicleSeoTitleInput = {
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
  price?: number;
  sold?: boolean;
  siteName?: string;
  maxLength?: number;
};

/**
 * Título único para SEO com marca, modelo, ano, preço e cidade:
 * "Honda Civic LXR 2015 por R$ 74.900 em Linhares/ES | Garagem".
 *
 * Quando passa do limite (60 caracteres), corta palavras da versão antes do
 * sufixo para evitar que o buscador corte a marca e o contexto regional.
 * Carro vendido não divulga preço antigo: "Honda Civic LXR 2015 (vendido) em Linhares/ES | Garagem".
 */
export function vehicleSeoTitle(input: VehicleSeoTitleInput) {
  const siteName = input.siteName ?? site.name;
  const max = input.maxLength ?? VEHICLE_SEO_TITLE_MAX;
  const base = formatVehicleLabel(input.brand, input.model);
  const year = String(input.yearModel);
  const versionTokens = shortVersion(input.version, input.model)
    .split(/\s+/)
    .filter(Boolean);

  const status = input.sold
    ? " (vendido)"
    : input.price != null && Number.isFinite(input.price) && input.price > 0
      ? ` por ${formatCurrencyBRL(input.price)}`
      : "";

  const suffixes = [
    ` | seminovo em ${SEO_LOCAL_LOCATION} | ${siteName}`,
    ` em ${SEO_LOCAL_LOCATION} | ${siteName}`,
    ` | ${siteName}`,
  ];

  for (const suffix of suffixes) {
    for (let n = versionTokens.length; n >= 0; n--) {
      const versionPart = versionTokens.slice(0, n).join(" ");
      const label = [base, versionPart, year].filter(Boolean).join(" ");
      const candidate = `${label}${status}${suffix}`;
      if (candidate.length <= max) return candidate;
    }
  }

  // Marca + modelo + ano + status já estouram o limite: devolve com sufixo mínimo sem quebrar.
  return `${[base, year].filter(Boolean).join(" ")}${status}${suffixes[suffixes.length - 1]}`;
}

export function inferOpenGraphImageType(url: string) {
  const clean = url.split(/[?#]/)[0]?.toLowerCase() ?? "";
  if (clean.includes("/fotos/v1/1280-contain-q78/") || clean.endsWith(".webp")) {
    return "image/webp";
  }
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (clean.endsWith(".png")) {
    return "image/png";
  }
  return "image/webp";
}

export function vehicleAbsolutePhotoUrl(rawUrl: string) {
  return absoluteHttpsUrl(publicVehiclePhotoSrc(rawUrl));
}

/** Imagem de compartilhamento social (Open Graph / WhatsApp) com dimensões acessíveis ao crawler. */
export function vehicleOpenGraphImage(input: {
  url: string;
  alt: string;
  width?: number;
  height?: number;
  type?: string;
}) {
  const url = /^https?:\/\//i.test(input.url)
    ? absoluteHttpsUrl(input.url)
    : input.url;
  return {
    url,
    width: input.width ?? 1200,
    height: input.height ?? 800,
    type: input.type ?? inferOpenGraphImageType(url),
    alt: input.alt,
  };
}

export function buildVehicleFichaMetadata(vehicle: {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  yearModel: number;
  price: number;
  km: number;
  transmission: string;
  color?: string | null;
  category?: string;
  status: string;
  photos: Array<{ url: string }>;
}): Metadata {
  const sold = vehicle.status === "vendido";
  const display = formatVehicleDisplay(vehicle);
  const label = display.fullLabel;
  const title = vehicleSeoTitle({
    brand: vehicle.brand,
    model: vehicle.model,
    version: vehicle.version,
    yearModel: vehicle.yearModel,
    price: vehicle.price,
    sold,
    siteName: site.name,
  });
  const description = vehicleSeoDescription({
    brand: vehicle.brand,
    model: vehicle.model,
    version: display.version,
    year: vehicle.yearModel,
    price: vehicle.price,
    km: vehicle.km,
    transmission: display.transmission,
    sold,
    siteName: site.name,
  });
  const rawCover = vehicle.photos[0]?.url?.trim();
  const cover = rawCover ? vehicleAbsolutePhotoUrl(rawCover) : null;
  const fallbackOg = absoluteHttpsUrl("/og.png");
  const path = vehiclePath(vehicle);

  return {
    title,
    description,
    alternates: { canonical: pageCanonicalPath(path) },
    robots: sold ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: site.name,
      title,
      description,
      url: absoluteUrl(path),
      images: cover
        ? [vehicleOpenGraphImage({ url: cover, alt: label })]
        : [
            {
              url: fallbackOg,
              width: 1200,
              height: 630,
              type: "image/png",
              alt: title,
            },
          ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: cover ?? fallbackOg, alt: label }],
    },
  };
}
