import { cache } from "react";
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
  aboutSold: string;
  aboutHours: string;
  aboutFocus: string;
};

const DEFAULT_ABOUT = {
  aboutYears: "+20",
  aboutSold: "+1.000",
  aboutHours: "8h–23h",
  aboutFocus: "100%",
} as const;

const EDITABLE_KEYS = [
  "region",
  "email",
  "address",
  "hours",
  "hoursWeekdays",
  "hoursSaturday",
  "aboutYears",
  "aboutSold",
  "aboutHours",
  "aboutFocus",
] as const satisfies readonly (keyof EditableSiteFields)[];

function pickEditable(
  source: SiteConfig | EditableSiteFields,
): EditableSiteFields {
  const about = source as Partial<EditableSiteFields>;
  return {
    region: source.region,
    email: source.email,
    address: source.address,
    hours: source.hours,
    hoursWeekdays: source.hoursWeekdays,
    hoursSaturday: source.hoursSaturday,
    aboutYears: about.aboutYears ?? DEFAULT_ABOUT.aboutYears,
    aboutSold: about.aboutSold ?? DEFAULT_ABOUT.aboutSold,
    aboutHours: about.aboutHours ?? DEFAULT_ABOUT.aboutHours,
    aboutFocus: about.aboutFocus ?? DEFAULT_ABOUT.aboutFocus,
  };
}

function coalesce(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * Mistura defaults de `site.ts` com o que estiver salvo no banco.
 */
export const getPublicSite = cache(async (): Promise<SiteConfig & EditableSiteFields> => {
  const defaults = pickEditable(site as SiteConfig & EditableSiteFields);

  try {
    const row = await prisma.siteSettings.findUnique({
      where: { id: "default" },
    });

    if (!row) {
      return { ...site, ...defaults };
    }

    return {
      ...site,
      region: coalesce(row.region, defaults.region),
      email: coalesce(row.email, defaults.email),
      address: coalesce(row.address, defaults.address),
      hours: coalesce(row.hours, defaults.hours),
      hoursWeekdays: coalesce(row.hoursWeekdays, defaults.hoursWeekdays),
      hoursSaturday: coalesce(row.hoursSaturday, defaults.hoursSaturday),
      aboutYears: coalesce(row.aboutYears, defaults.aboutYears),
      aboutSold: coalesce(row.aboutSold, defaults.aboutSold),
      aboutHours: coalesce(row.aboutHours, defaults.aboutHours),
      aboutFocus: coalesce(row.aboutFocus, defaults.aboutFocus),
    };
  } catch (error) {
    console.error("[site-settings] falha ao ler config:", error);
    return { ...site, ...defaults };
  }
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
