import { PHONES, isPhysicalAddress, site, type SiteConfig } from "@/lib/site";

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

export function localBusinessJsonLd(config: SiteConfig = site) {
  const street = isPhysicalAddress(config.address)
    ? real(config.address)
    : undefined;

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
    areaServed: {
      "@type": "State",
      name: config.state,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "08:00",
      closes: "23:00",
    },
    address: {
      "@type": "PostalAddress",
      ...(street ? { streetAddress: street } : {}),
      addressRegion: config.stateCode,
      addressCountry: "BR",
    },
    ...(real(config.email) ? { email: config.email } : {}),
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
  const name = `${vehicle.brand} ${vehicle.model}${
    vehicle.version ? ` ${vehicle.version}` : ""
  } ${vehicle.yearModel}`;

  return {
    "@context": "https://schema.org",
    "@type": vehicle.category === "moto" ? "Motorcycle" : "Car",
    name,
    brand: { "@type": "Brand", name: vehicle.brand },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.yearModel),
    productionDate: String(vehicle.year),
    ...(vehicle.color ? { color: vehicle.color } : {}),
    ...(vehicle.description ? { description: vehicle.description } : {}),
    image: vehicle.photos.map((photo) => photo.url),
    url: absoluteUrl(`/estoque/${vehicle.id}`),
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
        vehicle.status === "disponivel"
          ? "https://schema.org/InStock"
          : "https://schema.org/LimitedAvailability",
      url: absoluteUrl(`/estoque/${vehicle.id}`),
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
