import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { site, type SiteConfig } from "@/lib/site";

export type EditableSiteFields = {
  region: string;
  email: string;
  address: string;
  hours: string;
  hoursWeekdays: string;
  hoursSaturday: string;
  aboutYears: string;
  aboutHours: string;
  aboutFocus: string;
  /** Soma com veículos disponíveis reais na home. */
  statsStockBase: number;
  /** Soma com vendas reais na home e em Sobre. */
  statsSalesBase: number;
};

const DEFAULT_ABOUT = {
  aboutYears: "+20",
  aboutHours: "8h–23h",
  aboutFocus: "100%",
  statsStockBase: 0,
  statsSalesBase: 0,
} as const;

const EDITABLE_KEYS = [
  "region",
  "email",
  "address",
  "hours",
  "hoursWeekdays",
  "hoursSaturday",
  "aboutYears",
  "aboutHours",
  "aboutFocus",
] as const satisfies readonly (keyof EditableSiteFields)[];

/** Extrai dígitos de textos legados tipo "+1.000". */
export function parseLegacySoldBase(raw: string | null | undefined): number {
  if (!raw) return 0;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  const value = Number(digits);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function pickEditable(
  source: Partial<EditableSiteFields> &
    Pick<SiteConfig, "region" | "email" | "address" | "hours" | "hoursWeekdays" | "hoursSaturday">,
): EditableSiteFields {
  return {
    region: source.region,
    email: source.email,
    address: source.address,
    hours: source.hours,
    hoursWeekdays: source.hoursWeekdays,
    hoursSaturday: source.hoursSaturday,
    aboutYears: source.aboutYears ?? DEFAULT_ABOUT.aboutYears,
    aboutHours: source.aboutHours ?? DEFAULT_ABOUT.aboutHours,
    aboutFocus: source.aboutFocus ?? DEFAULT_ABOUT.aboutFocus,
    statsStockBase:
      typeof source.statsStockBase === "number" && source.statsStockBase >= 0
        ? Math.floor(source.statsStockBase)
        : DEFAULT_ABOUT.statsStockBase,
    statsSalesBase:
      typeof source.statsSalesBase === "number" && source.statsSalesBase >= 0
        ? Math.floor(source.statsSalesBase)
        : DEFAULT_ABOUT.statsSalesBase,
  };
}

function coalesce(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

const loadPublicSiteCached = unstable_cache(
  async (): Promise<SiteConfig & EditableSiteFields> => {
    const defaults = pickEditable(site as SiteConfig & EditableSiteFields);

    try {
      const row = await prisma.siteSettings.findUnique({
        where: { id: "default" },
      });

      if (!row) {
        return { ...site, ...defaults };
      }

      const salesBaseFromLegacy = parseLegacySoldBase(row.aboutSold);
      const statsSalesBase =
        row.statsSalesBase > 0 ? row.statsSalesBase : salesBaseFromLegacy;

      return {
        ...site,
        region: coalesce(row.region, defaults.region),
        email: coalesce(row.email, defaults.email),
        address: coalesce(row.address, defaults.address),
        hours: coalesce(row.hours, defaults.hours),
        hoursWeekdays: coalesce(row.hoursWeekdays, defaults.hoursWeekdays),
        hoursSaturday: coalesce(row.hoursSaturday, defaults.hoursSaturday),
        aboutYears: coalesce(row.aboutYears, defaults.aboutYears),
        aboutHours: coalesce(row.aboutHours, defaults.aboutHours),
        aboutFocus: coalesce(row.aboutFocus, defaults.aboutFocus),
        statsStockBase: row.statsStockBase ?? 0,
        statsSalesBase,
      };
    } catch (error) {
      console.error("[site-settings] falha ao ler config:", error);
      return { ...site, ...defaults };
    }
  },
  ["public-site-settings-v2"],
  { revalidate: 120, tags: ["site-settings"] },
);

/**
 * Mistura defaults de `site.ts` com o que estiver salvo no banco.
 * React cache deduplica no request; unstable_cache cobre requests seguintes.
 */
export const getPublicSite = cache(async (): Promise<SiteConfig & EditableSiteFields> => {
  return loadPublicSiteCached();
});

/** Valores efetivos dos campos editáveis (já com fallback). */
export async function getEditableSiteFields(): Promise<EditableSiteFields> {
  return pickEditable(await getPublicSite());
}

export function listPlaceholderLabels(config: EditableSiteFields) {
  return EDITABLE_KEYS.filter((key) => {
    if (key.startsWith("about")) return false;
    return config[key].includes("[");
  }).map((key) => {
    switch (key) {
      case "region":
        return "Cidade/região";
      case "email":
        return "E-mail";
      case "address":
        return "Endereço";
      case "hours":
        return "Horário";
      case "hoursWeekdays":
        return "Horário seg–sex";
      case "hoursSaturday":
        return "Horário sábado";
      default:
        return key;
    }
  });
}

export { DEFAULT_ABOUT };
