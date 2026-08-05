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
};

const EDITABLE_KEYS = [
  "region",
  "email",
  "address",
  "hours",
  "hoursWeekdays",
  "hoursSaturday",
] as const satisfies readonly (keyof EditableSiteFields)[];

function pickEditable(source: SiteConfig | EditableSiteFields): EditableSiteFields {
  return {
    region: source.region,
    email: source.email,
    address: source.address,
    hours: source.hours,
    hoursWeekdays: source.hoursWeekdays,
    hoursSaturday: source.hoursSaturday,
  };
}

function coalesce(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

/**
 * Mistura defaults de `site.ts` com o que estiver salvo no banco.
 * Cache por request (React.cache) — várias páginas no mesmo render compartilham.
 */
export const getPublicSite = cache(async (): Promise<SiteConfig> => {
  const defaults = pickEditable(site);

  try {
    const row = await prisma.siteSettings.findUnique({
      where: { id: "default" },
    });

    if (!row) return { ...site };

    return {
      ...site,
      region: coalesce(row.region, defaults.region),
      email: coalesce(row.email, defaults.email),
      address: coalesce(row.address, defaults.address),
      hours: coalesce(row.hours, defaults.hours),
      hoursWeekdays: coalesce(row.hoursWeekdays, defaults.hoursWeekdays),
      hoursSaturday: coalesce(row.hoursSaturday, defaults.hoursSaturday),
    };
  } catch (error) {
    console.error("[site-settings] falha ao ler config:", error);
    return { ...site };
  }
});

/** Valores efetivos dos campos editáveis (já com fallback). */
export async function getEditableSiteFields(): Promise<EditableSiteFields> {
  return pickEditable(await getPublicSite());
}

export function listPlaceholderLabels(config: EditableSiteFields) {
  return EDITABLE_KEYS.filter((key) => config[key].includes("[")).map((key) => {
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
