import type { Metadata } from "next";
import { formatBrandName, formatModelName } from "@/lib/format";
import { PHONES, isPhysicalAddress, site, type SiteConfig } from "@/lib/site";
import { vehiclePath } from "@/lib/vehicle-slug";

/**
 * Placeholders (entre colchetes) não devem ir para os dados estruturados:
 * o Google trata valor fictício como informação incorreta do negócio.
 */
function real(value: string) {
  return value.includes("[") ? undefined : value;
}

/** Cidades de atuação — schema, landings e llms.txt. */
export const SERVICE_CITIES = [
  { slug: "aracruz", name: "Aracruz" },
  { slug: "vitoria", name: "Vitória" },
  { slug: "linhares", name: "Linhares" },
] as const;

export type ServiceCitySlug = (typeof SERVICE_CITIES)[number]["slug"];

export function getServiceCity(slug: string) {
  return SERVICE_CITIES.find((city) => city.slug === slug) ?? null;
}

export function absoluteUrl(path = "/") {
  return new URL(path, site.url).toString();
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
    alternates: { canonical: path },
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

export function localBusinessJsonLd(config: SiteConfig = site) {
  const street = isPhysicalAddress(config.address)
    ? real(config.address)
    : undefined;
  const weekday = parseHourRange(config.hoursWeekdays);
  const saturday = parseHourRange(config.hoursSaturday);
  const sunday = parseHourRange(config.hoursSunday);

  return {
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
    sameAs: [config.instagramUrl],
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
      addressLocality: "Aracruz",
      addressRegion: config.stateCode,
      addressCountry: "BR",
    },
    ...(real(config.email) ? { email: config.email } : {}),
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
      const brand = formatBrandName(vehicle.brand);
      const model = formatModelName(vehicle.model);
      const name = `${brand} ${model}${
        vehicle.version ? ` ${vehicle.version}` : ""
      } ${vehicle.yearModel}`.replace(/\s+/g, " ").trim();
      return {
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(vehiclePath(vehicle)),
        name,
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
  photos: { url: string }[];
}) {
  const brand = formatBrandName(vehicle.brand);
  const model = formatModelName(vehicle.model);
  const name = `${brand} ${model}${
    vehicle.version ? ` ${vehicle.version}` : ""
  } ${vehicle.yearModel}`.replace(/\s+/g, " ").trim();
  const path = vehiclePath(vehicle);

  return {
    "@context": "https://schema.org",
    "@type": vehicle.category === "moto" ? "Motorcycle" : "Car",
    name,
    brand: { "@type": "Brand", name: brand },
    model,
    vehicleModelDate: String(vehicle.yearModel),
    productionDate: String(vehicle.year),
    ...(vehicle.color ? { color: vehicle.color } : {}),
    ...(vehicle.description ? { description: vehicle.description } : {}),
    image: vehicle.photos.map((photo) => photo.url),
    url: absoluteUrl(path),
    mileageFromOdometer: {
      "@type": "QuantitativeValue",
      value: vehicle.km,
      unitCode: "KMT",
    },
    fuelType: vehicle.fuel,
    vehicleTransmission: vehicle.transmission,
    itemCondition: "https://schema.org/UsedCondition",
    offers: {
      "@type": "Offer",
      price: vehicle.price,
      priceCurrency: "BRL",
      availability:
        vehicle.status === "vendido"
          ? "https://schema.org/OutOfStock"
          : vehicle.status === "disponivel"
            ? "https://schema.org/InStock"
            : "https://schema.org/LimitedAvailability",
      url: absoluteUrl(path),
      seller: { "@id": absoluteUrl("/#loja") },
    },
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
