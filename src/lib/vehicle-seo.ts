import { formatVehicleLabel } from "@/lib/format";
import { SEO_LOCAL_LOCATION } from "@/lib/seo-local";
import { shortVersion } from "@/lib/vehicle-display";
import { site } from "@/lib/site";

/**
 * Região usada nos títulos de busca local das fichas (vem de `seo-local`, o
 * ponto único da região). Não é a cidade individual do carro: a cidade do
 * veículo só aparece no admin (PR #219) e os carros podem estar em outras
 * cidades (consignados).
 */
export const VEHICLE_SEO_LOCATION = SEO_LOCAL_LOCATION;

/** O Google corta títulos por volta de 60 caracteres. */
export const VEHICLE_SEO_TITLE_MAX = 60;

type VehicleSeoTitleInput = {
  brand: string;
  model: string;
  version?: string | null;
  yearModel: number;
  sold?: boolean;
  siteName?: string;
  location?: string;
  maxLength?: number;
};

/**
 * "Honda City EXL 2018 em Linhares/ES | Garagem".
 *
 * Quando passa do limite, corta primeiro as palavras finais da versão (marca,
 * modelo e ano ficam), e só depois abre mão da região. Vendido não leva
 * região nem preço: "Honda City EXL 2018 (vendido) | Garagem".
 */
export function vehicleSeoTitle(input: VehicleSeoTitleInput) {
  const siteName = input.siteName ?? site.name;
  const location = input.location ?? VEHICLE_SEO_LOCATION;
  const max = input.maxLength ?? VEHICLE_SEO_TITLE_MAX;
  const base = formatVehicleLabel(input.brand, input.model);
  const year = String(input.yearModel);
  const versionTokens = shortVersion(input.version, input.model)
    .split(/\s+/)
    .filter(Boolean);

  const suffixes = input.sold
    ? [` (vendido) | ${siteName}`]
    : [` em ${location} | ${siteName}`, ` | ${siteName}`];

  for (const suffix of suffixes) {
    for (let n = versionTokens.length; n >= 0; n--) {
      const label = [base, ...versionTokens.slice(0, n), year].join(" ");
      if (label.length + suffix.length <= max) return label + suffix;
    }
  }
  // Marca + modelo + ano já estouram o limite: devolve o mínimo sem cortar.
  return `${base} ${year}${suffixes[suffixes.length - 1]}`;
}
