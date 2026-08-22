import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  FAQ_ITEMS,
  isFaqAnswerReady,
  parseFaqItems,
  publishedFaqItems,
  type FaqItem,
} from "@/lib/faq";
import {
  DEFAULT_GOOGLE_REVIEWS,
  type GoogleReviews,
} from "@/lib/google-reviews";
import {
  DEFAULT_VEHICLE_CONDITIONS,
  isPlaceholderCopy,
  publishedConditionItems,
  type ConditionItem,
  type VehicleConditionsContent,
} from "@/lib/vehicle-conditions";

export type SiteContent = {
  google: GoogleReviews;
  faqItems: FaqItem[];
  conditions: VehicleConditionsContent;
  /** Foto original do sócio na Sobre. Vazio = seção sem retrato. */
  founderPhotoUrl: string | null;
};

const FOUNDER_PHOTO_HOST = "vesmqhyxautgtvgccweo.supabase.co";

export function parseFounderPhotoUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("/branding/") && !value.includes("..")) {
    return value.slice(0, 300);
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === FOUNDER_PHOTO_HOST) {
      return url.toString().slice(0, 500);
    }
  } catch {
    return null;
  }
  return null;
}

const EMPTY_SITE_CONTENT: SiteContent = {
  google: DEFAULT_GOOGLE_REVIEWS,
  faqItems: FAQ_ITEMS,
  conditions: DEFAULT_VEHICLE_CONDITIONS,
  founderPhotoUrl: null,
};

const SITE_CONTENT_SELECT = {
  googleRating: true,
  googleReviewCount: true,
  googleProfileUrl: true,
  faqJson: true,
  conditionsTitle: true,
  conditionsIntro: true,
  conditionsJson: true,
} as const;

function parseGoogle(
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
  profileUrl: string | null | undefined,
): GoogleReviews {
  const safeRating = Number(rating);
  const safeCount = Number(reviewCount);
  return {
    rating:
      Number.isFinite(safeRating) && safeRating > 0
        ? Math.min(5, Math.round(safeRating * 10) / 10)
        : 0,
    reviewCount:
      Number.isFinite(safeCount) && safeCount > 0 ? Math.floor(safeCount) : 0,
    profileUrl: (profileUrl ?? "").trim(),
  };
}

function fallbackIfPlaceholder(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed || isPlaceholderCopy(trimmed)) return fallback;
  return trimmed;
}

function mergeConditions(
  title: string | null | undefined,
  intro: string | null | undefined,
  raw: unknown,
): VehicleConditionsContent {
  const items = parseConditionItems(raw);
  const mergedItems = (items ?? DEFAULT_VEHICLE_CONDITIONS.items).map((item) => {
    const fallback = DEFAULT_VEHICLE_CONDITIONS.items.find(
      (defaultItem) =>
        defaultItem.label.toLocaleLowerCase("pt-BR") ===
        item.label.toLocaleLowerCase("pt-BR"),
    );
    if (!fallback || isPlaceholderCopy(fallback.text)) return item;
    return {
      ...item,
      text: fallbackIfPlaceholder(item.text, fallback.text),
    };
  });

  return {
    title: fallbackIfPlaceholder(title ?? "", DEFAULT_VEHICLE_CONDITIONS.title),
    intro: fallbackIfPlaceholder(intro ?? "", DEFAULT_VEHICLE_CONDITIONS.intro),
    items: mergedItems,
  };
}

/** Se o painel ainda tiver PREENCHER, usa o texto-base já preenchido (ex.: garantia). */
function mergeFaqItems(items: FaqItem[]): FaqItem[] {
  return items.map((item) => {
    if (isFaqAnswerReady(item.answer)) return item;
    const fallback = FAQ_ITEMS.find(
      (defaultItem) => defaultItem.question === item.question,
    );
    if (fallback && isFaqAnswerReady(fallback.answer)) {
      return { ...item, answer: fallback.answer };
    }
    return item;
  });
}

export function parseConditionItems(raw: unknown): ConditionItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: ConditionItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!label && !text) continue;
    items.push({
      label: (label || "Item").slice(0, 80),
      text: text.slice(0, 500),
    });
  }
  return items.length > 0 ? items : null;
}

async function loadSiteSettingsRow() {
  try {
    return await prisma.siteSettings.findUnique({
      where: { id: "default" },
      select: { ...SITE_CONTENT_SELECT, founderPhotoUrl: true },
    });
  } catch {
    // Coluna nova: o painel funciona antes do `prisma db push`.
    return await prisma.siteSettings.findUnique({
      where: { id: "default" },
      select: SITE_CONTENT_SELECT,
    });
  }
}

const loadSiteContentCached = unstable_cache(
  async (): Promise<SiteContent> => {
    try {
      const row = await loadSiteSettingsRow();

      if (!row) {
        return EMPTY_SITE_CONTENT;
      }

      return {
        google: parseGoogle(
          row.googleRating,
          row.googleReviewCount,
          row.googleProfileUrl,
        ),
        faqItems: mergeFaqItems(parseFaqItems(row.faqJson) ?? FAQ_ITEMS),
        conditions: mergeConditions(
          row.conditionsTitle,
          row.conditionsIntro,
          row.conditionsJson,
        ),
        founderPhotoUrl: parseFounderPhotoUrl(
          "founderPhotoUrl" in row ? row.founderPhotoUrl : null,
        ),
      };
    } catch (error) {
      console.error("[site-content] falha ao ler conteúdo do site:", error);
      return EMPTY_SITE_CONTENT;
    }
  },
  ["public-site-content-v3"],
  { revalidate: 120, tags: ["site-settings"] },
);

export const getSiteContent = cache(async (): Promise<SiteContent> => {
  return loadSiteContentCached();
});

export const getGoogleReviews = cache(async () => {
  const content = await getSiteContent();
  return content.google;
});

export const getPublishedFaq = cache(async () => {
  const content = await getSiteContent();
  return publishedFaqItems(content.faqItems);
});

export const getVehicleConditions = cache(async () => {
  const content = await getSiteContent();
  return content.conditions;
});

export function publishedConditions(content: VehicleConditionsContent) {
  return {
    title: content.title,
    intro: content.intro,
    items: publishedConditionItems(content.items),
  };
}
