import { publicVehicleDescription } from "./public-vehicle-description";
import type { Metadata } from "next";
import { publicVehiclePhotoSrc } from "@/lib/public-photo-url";
import { formatBrandName, formatModelName, vehicleSeoDescription } from "@/lib/format";
import {
  publicGoogleUrl,
  type GoogleReviews,
} from "@/lib/google-reviews";
import {
  SERVICE_CITIES,
  type ServiceCity,
} from "@/lib/service-cities";
import {
  PHONES,
  configuredMapsUrl,
  isPhysicalAddress,
  site,
  type SiteConfig,
} from "@/lib/site";
import {
  DEFAULT_VEHICLE_LOCATION_CITY,
  vehicleLocationLabel,
} from "@/lib/vehicle-location";
import {
  buildVehicleFullLabel,
  collapseWhitespace,
  formatVehicleDisplay,
} from "@/lib/vehicle-display";
import { vehiclePath } from "@/lib/vehicle-slug";

export {
  CITIES_DIRECTORY_PATH,
  SERVICE_CITIES,
  getServiceCity,
  otherServiceCities,
  type ServiceCity,
  type ServiceCitySlug,
} from "@/lib/service-cities";

/**
 * Placeholders (entre colchetes) não devem ir para os dados estruturados:
 * o Google trata valor fictício como informação incorreta do negócio.
 */
function real(value: string) {
  return value.includes("[") ? undefined : value;
}

export function absoluteUrl(path = "/") {
  return new URL(path, site.url).toString();
}

export function absoluteHttpsUrl(pathOrUrl = "/") {
  const raw = absoluteUrl(pathOrUrl);
  try {
    const parsed = new URL(raw);
    if (
      parsed.protocol === "http:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    ) {
      parsed.protocol = "https:";
      return parsed.toString();
    }
    return parsed.toString();
  } catch {
    return raw;
  }
}

/** Canonical relativo — o metadataBase do root vira URL absoluta. */
export function pageCanonicalPath(path: string) {
  if (!path || path === "/") return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function hasPublishablePrice(price: number) {
  return Number.isFinite(price) && price > 0;
}

export function vehicleAvailabilityUrl(status: string) {
  if (status === "disponivel") return "https://schema.org/InStock";
  return "https://schema.org/OutOfStock";
}

export const VEHICLE_SELLER_AREA_SERVED = [
  { "@type": "City", name: "Linhares" },
  { "@type": "City", name: "Aracruz" },
  { "@type": "AdministrativeArea", name: "Grande Vitória" },
] as const;

export type VehicleSchemaTransmission =
  | "Manual"
  | "Automático"
  | "CVT"
  | "Xtronic";

function classifySchemaGear(value: string | null | undefined): VehicleSchemaTransmission | null {
  const folded = (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!folded) return null;
  if (/\bx[-\s]?tronic\b/.test(folded)) return "Xtronic";
  if (/\b(?:[ei][-\s]?)?cvt\b|\bmultidrive\b/.test(folded)) return "CVT";
  if (
    /\bmanual\b|\bmecanic[oa]\b|(?:^|[\s/])mec\.?(?=\s|$)|\bmt\d?\b/.test(folded)
  ) {
    return "Manual";
  }
  if (
    /\bsemi[-\s]*automatic[oa]\b|\bsemiautomatic[oa]\b|\bautomatizad[oa]\b|\bdualogic\b|\bi[-\s]?motion\b|\beasytronic\b|\bgsr\b|\btwinlogic\b|\bpowershift\b|\btiptronic\b|\bs[-\s]?tronic\b|\bdsg\b|\bpdk\b|\bautomatic[oa]?\b|(?:^|[\s/])aut\.?(?=\s|$)|\bat\d?\b/.test(
      folded,
    )
  ) {
    return "Automático";
  }
  return null;
}

/**
 * Câmbio limpo para schema.org (sem número de marchas e sem potência/cv):
 * apenas 'Manual', 'Automático', 'CVT' ou 'Xtronic'.
 */
export function vehicleSchemaTransmission(
  transmission?: string | null,
  version?: string | null,
): VehicleSchemaTransmission | undefined {
  const fromVersion = classifySchemaGear(version);
  const fromField = classifySchemaGear(transmission);
  if (fromVersion && fromField) {
    const manualConflict = (fromVersion === "Manual") !== (fromField === "Manual");
    if (manualConflict) return fromVersion;
    if (fromVersion === "Xtronic" || fromField === "Xtronic") return "Xtronic";
    if (fromVersion === "CVT" || fromField === "CVT") return "CVT";
    return fromField;
  }
  return fromField ?? fromVersion ?? undefined;
}

const JSONLD_FORBIDDEN_LINE =
  /\b(?:parcelad[oa]s?|parcelas?|parcelamento|placa|chassis?|renavam|fipe|loja\s+digital|loja\s+f[ií]sica|pontos?\s+de\s+venda|atendimento\s+com\s+hora\s+marcada)\b|\b\d{1,3}\s*x\s*(?:de\s*|sem\s+juros|no\s+cart[aã]o|R\s*\$|\d)|\bentrada\s*(?:de\s*R?\$?\s*[\d.,]+\s*)?\+\s*\d{1,3}\s*x\b/i;

const BRAZIL_PLATE_TOKEN =
  /\b[A-Z]{3}[-\s]?(?:\d{4}|\d[A-Z]\d{2})\b/gi;

const VIN_CHASSIS_TOKEN =
  /\b(?=[A-HJ-NPR-Z0-9]*\d)(?=[A-HJ-NPR-Z0-9]*[A-HJ-NPR-Z])[A-HJ-NPR-Z0-9]{17}\b/gi;

const RENAVAM_DIGITS_TOKEN = /\b\d{9,11}\b/g;

export function sanitizeVehicleJsonLdDescription(
  text: string | null | undefined,
  sold: boolean,
): string | null {
  const base = publicVehicleDescription(text ?? null, sold);
  if (!base) return null;
  const cleanedSentences = base
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((segment) =>
      segment
        .replace(BRAZIL_PLATE_TOKEN, "")
        .replace(VIN_CHASSIS_TOKEN, "")
        .replace(RENAVAM_DIGITS_TOKEN, "")
        .trim(),
    )
    .filter((segment) => segment.length > 0 && !JSONLD_FORBIDDEN_LINE.test(segment));
  const joined = collapseWhitespace(cleanedSentences.join(" "))
    .replace(/\s+([.,;!?])/g, "$1")
    .replace(/^[.,;!?\s-]+|[.,;!?\s-]+$/g, (match) =>
      /[.!?]$/.test(match.trim()) ? match.trim().slice(-1) : "",
    )
    .trim();
  return joined || null;
}

function sanitizeEngineForJsonLd(engine: string | null | undefined): string | null {
  if (!engine) return null;
  const stripped = collapseWhitespace(
    engine
      .replace(BRAZIL_PLATE_TOKEN, "")
      .replace(VIN_CHASSIS_TOKEN, "")
      .replace(RENAVAM_DIGITS_TOKEN, "")
      .replace(/\b\d+(?:[.,]\d+)?\s*(?:cv|hp|cavalos?)\b/gi, "")
      .replace(/\b\d+\s*(?:marchas?|velocidades?)\b/gi, ""),
  ).replace(/^[\s/.,()-]+|[\s/.,()-]+$/g, "");
  if (!stripped || JSONLD_FORBIDDEN_LINE.test(stripped)) return null;
  return stripped;
}

function parseHourRange(raw: string | undefined) {
  const match = String(raw ?? "").match(/(\d{1,2}:\d{2}).*?(\d{1,2}:\d{2})/);
  if (!match) return { opens: "08:00", closes: "23:00" };
  const pad = (value: string) =>
    value.length === 4 ? `0${value}` : value;
  return { opens: pad(match[1]), closes: pad(match[2]) };
}

/** Metadata com OG/Twitter alinhados ao title/description da página. */
export function buildPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: pageCanonicalPath(path) },
    ...(noIndex
      ? { robots: { index: false, follow: true } }
      : { robots: { index: true, follow: true } }),
    openGraph: {
      type: "website",
      locale: "pt_BR",
      url,
      siteName: site.name,
      title,
      description,
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: `${site.name} — seminovos no ${site.state}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/og.png"],
    },
  };
}

/** Depoimento real (do banco) pronto para virar Review no JSON-LD. */
export type ReviewInput = {
  name: string;
  city?: string | null;
  message: string;
  rating: number;
};

const clampRating = (rating: number) =>
  String(Math.min(5, Math.max(1, Math.round(rating || 5))));

export function localBusinessJsonLd(
  config: SiteConfig = site,
  reviews?: ReviewInput[],
  google?: GoogleReviews,
) {
  const street = isPhysicalAddress(config.address)
    ? real(config.address)
    : undefined;
  const weekday = parseHourRange(config.hoursWeekdays);
  const saturday = parseHourRange(config.hoursSaturday);
  const sunday = parseHourRange(config.hoursSunday);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    "@id": absoluteUrl("/#loja"),
    name: config.name,
    legalName: config.legalName,
    taxID: config.cnpj.replace(/\D/g, ""),
    url: absoluteUrl("/"),
    image: absoluteUrl("/og.png"),
    logo: absoluteUrl("/icons/icon-512.png"),
    description: config.tagline,
    telephone: PHONES.map((phone) => `+${phone.digits}`),
    sameAs: [
      config.instagramUrl,
      configuredMapsUrl(
        "googleMapsUrl" in config ? config.googleMapsUrl : "",
        publicGoogleUrl(google),
      ),
    ].filter(Boolean),
    priceRange: "$$",
    areaServed: [
      {
        "@type": "State",
        name: config.state,
      },
      ...SERVICE_CITIES.map((city) => ({
        "@type": "City",
        name: city.name,
        containedInPlace: {
          "@type": "State",
          name: config.state,
        },
      })),
    ],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
        ],
        opens: weekday.opens,
        closes: weekday.closes,
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: saturday.opens,
        closes: saturday.closes,
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Sunday",
        opens: sunday.opens,
        closes: sunday.closes,
      },
    ],
    address: {
      "@type": "PostalAddress",
      ...(street ? { streetAddress: street } : {}),
      addressLocality: vehicleLocationLabel(DEFAULT_VEHICLE_LOCATION_CITY),
      addressRegion: config.stateCode,
      addressCountry: "BR",
    },
    ...(real(config.email) ? { email: config.email } : {}),
  };

  // Rich snippet de estrelas — somente com depoimentos REAIS aprovados
  // (o fallback de seed nunca entra nos dados estruturados).
  if (reviews && reviews.length > 0) {
    const ratings = reviews.map((review) =>
      Math.min(5, Math.max(1, Math.round(review.rating || 5))),
    );
    const average =
      ratings.reduce((total, value) => total + value, 0) / ratings.length;

    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: average.toFixed(1),
      reviewCount: String(ratings.length),
      bestRating: "5",
      worstRating: "1",
    };
    data.review = reviews.slice(0, 5).map((review) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: review.name,
        ...(review.city ? { address: { "@type": "Place", name: reviewPlaceName(review.city) } } : {}),
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: clampRating(review.rating),
        bestRating: "5",
        worstRating: "1",
      },
      reviewBody: review.message,
    }));
  }

  return data;
}

/** Cidade do depoimento + UF, sem duplicar o sufixo ", ES" já digitado. */
function reviewPlaceName(city: string) {
  const name = city.trim().replace(/\s*,\s*ES$/i, "").trim();
  return `${name}, ES`;
}

/** JSON-LD da landing de cidade — amarra a página à cidade sem inventar endereço. */
export function serviceCityJsonLd(city: ServiceCity) {
  const path = `/seminovos/${city.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": absoluteUrl(`${path}#pagina`),
    name: `Seminovos em ${city.name}`,
    description: city.metaDescription,
    url: absoluteUrl(path),
    isPartOf: { "@id": absoluteUrl("/#website") },
    about: {
      "@type": "City",
      name: city.name,
      containedInPlace: {
        "@type": "State",
        name: site.state,
      },
    },
    provider: {
      "@type": "AutoDealer",
      "@id": absoluteUrl("/#loja"),
      name: site.name,
      areaServed: {
        "@type": "City",
        name: city.name,
        containedInPlace: {
          "@type": "State",
          name: site.state,
        },
      },
    },
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: site.name,
    url: absoluteUrl("/"),
    inLanguage: "pt-BR",
    publisher: { "@id": absoluteUrl("/#loja") },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/estoque?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function itemListJsonLd(
  items: Array<{
    id: string;
    brand: string;
    model: string;
    version: string | null;
    yearModel: number;
    price: number;
  }>,
  opts?: { name?: string; path?: string },
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts?.name ?? `Estoque em destaque — ${site.name}`,
    url: absoluteUrl(opts?.path ?? "/estoque"),
    numberOfItems: items.length,
    itemListElement: items.map((vehicle, index) => {
      return {
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(vehiclePath(vehicle)),
        name: buildVehicleFullLabel(vehicle),
      };
    }),
  };
}

export function vehicleJsonLd(vehicle: {
  id: string;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  yearModel: number;
  km: number;
  price: number;
  fuel: string;
  transmission: string;
  color: string | null;
  description: string | null;
  status: string;
  category?: string;
  engine?: string | null;
  doors?: number | null;
  photos: { url: string }[];
}) {
  const brand = formatBrandName(vehicle.brand);
  const model = formatModelName(vehicle.model);
  const display = formatVehicleDisplay(vehicle);
  const name = collapseWhitespace(
    display.fullLabel
      .replace(BRAZIL_PLATE_TOKEN, "")
      .replace(VIN_CHASSIS_TOKEN, "")
      .replace(RENAVAM_DIGITS_TOKEN, ""),
  );
  const path = display.path;
  const sold = vehicle.status === "vendido";
  const priceOk = !sold && hasPublishablePrice(vehicle.price);
  const availability = vehicleAvailabilityUrl(vehicle.status);
  const sanitizedDescription = sanitizeVehicleJsonLdDescription(
    vehicle.description,
    sold,
  );
  const rawDescription =
    sanitizedDescription ||
    vehicleSeoDescription({
      ...vehicle,
      version: display.version,
      year: vehicle.yearModel,
      sold,
    });
  const description = rawDescription ? collapseWhitespace(rawDescription) : null;
  const schemaTransmission = vehicleSchemaTransmission(
    vehicle.transmission,
    vehicle.version,
  );
  const cleanEngine = sanitizeEngineForJsonLd(vehicle.engine);
  const cleanVersion = vehicle.version?.trim()
    ? collapseWhitespace(
        vehicle.version
          .replace(BRAZIL_PLATE_TOKEN, "")
          .replace(VIN_CHASSIS_TOKEN, "")
          .replace(RENAVAM_DIGITS_TOKEN, "")
          .replace(/\b\d+(?:[.,]\d+)?\s*(?:cv|hp|cavalos?)\b/gi, "")
          .replace(/\b\d+\s*(?:marchas?|velocidades?)\b/gi, ""),
      )
    : "";

  const seller = {
    "@type": "AutoDealer",
    "@id": absoluteUrl("/#loja"),
    name: site.name,
    url: absoluteUrl("/"),
    telephone: `+${site.whatsappNumber}`,
    areaServed: VEHICLE_SELLER_AREA_SERVED.map((area) => ({ ...area })),
    address: {
      "@type": "PostalAddress",
      addressLocality: vehicleLocationLabel(DEFAULT_VEHICLE_LOCATION_CITY),
      addressRegion: site.stateCode,
      addressCountry: "BR",
    },
  };
  const offers: Record<string, unknown> = {
    "@type": "Offer",
    availability,
    url: absoluteUrl(path),
    seller,
    itemCondition: "https://schema.org/UsedCondition",
  };
  if (priceOk) {
    offers.price = vehicle.price;
    offers.priceCurrency = "BRL";
  }
  const images = [
    ...new Set(
      vehicle.photos
        .map((photo) =>
          photo.url ? absoluteHttpsUrl(publicVehiclePhotoSrc(photo.url)) : "",
        )
        .filter(Boolean),
    ),
  ];

  return {
    "@context": "https://schema.org",
    "@type": vehicle.category === "moto" ? "Motorcycle" : "Car",
    "@id": absoluteUrl(`${path}#veiculo`),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absoluteUrl(path),
    },
    inLanguage: "pt-BR",
    name,
    sku: vehicle.id,
    brand: { "@type": "Brand", name: brand },
    model,
    vehicleModelDate: String(vehicle.yearModel),
    productionDate: String(vehicle.year),
    ...(display.color ? { color: display.color } : {}),
    ...(description ? { description } : {}),
    ...(cleanVersion && !JSONLD_FORBIDDEN_LINE.test(cleanVersion)
      ? { vehicleConfiguration: cleanVersion }
      : {}),
    ...(cleanEngine
      ? {
          vehicleEngine: {
            "@type": "EngineSpecification",
            name: cleanEngine,
          },
        }
      : {}),
    ...(vehicle.doors != null && vehicle.doors > 0
      ? { numberOfDoors: vehicle.doors }
      : {}),
    ...(images.length ? { image: images } : {}),
    url: absoluteUrl(path),
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: Number.isFinite(vehicle.km) ? Math.max(0, Math.round(vehicle.km)) : 0,
      unitCode: "KMT",
    },
    ...(vehicle.fuel?.trim() ? { fuelType: vehicle.fuel.trim() } : {}),
    ...(schemaTransmission ? { vehicleTransmission: schemaTransmission } : {}),
    itemCondition: "https://schema.org/UsedCondition",
    offers,
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
