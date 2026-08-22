import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FAQ_ITEMS, parseFaqItems, publishedFaqItems, type FaqItem } from "@/lib/faq";
import {
  DEFAULT_GOOGLE_REVIEWS,
  type GoogleReviews,
} from "@/lib/google-reviews";
import {
  DEFAULT_VEHICLE_CONDITIONS,
  publishedConditionItems,
  type ConditionItem,
  type VehicleConditionsContent,
} from "@/lib/vehicle-conditions";

export type SiteContent = {
  google: GoogleReviews;
  faqItems: FaqItem[];
  conditions: VehicleConditionsContent;
};

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

function parseConditions(
  title: string | null | undefined,
  intro: string | null | undefined,
  raw: unknown,
): VehicleConditionsContent {
  const items = parseConditionItems(raw);
  return {
    title: title?.trim() || DEFAULT_VEHICLE_CONDITIONS.title,
    intro: intro?.trim() || DEFAULT_VEHICLE_CONDITIONS.intro,
    items: items ?? DEFAULT_VEHICLE_CONDITIONS.items.map((item) => ({ ...item })),
  };
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

const loadSiteContentCached = unstable_cache(
  async (): Promise<SiteContent> => {
    try {
      const row = await prisma.siteSettings.findUnique({
        where: { id: "default" },
        select: {
          googleRating: true,
          googleReviewCount: true,
          googleProfileUrl: true,
          faqJson: true,
          conditionsTitle: true,
          conditionsIntro: true,
          conditionsJson: true,
        },
      });

      if (!row) {
        return {
          google: DEFAULT_GOOGLE_REVIEWS,
          faqItems: FAQ_ITEMS,
          conditions: DEFAULT_VEHICLE_CONDITIONS,
        };
      }

      return {
        google: parseGoogle(
          row.googleRating,
          row.googleReviewCount,
          row.googleProfileUrl,
        ),
        faqItems: parseFaqItems(row.faqJson) ?? FAQ_ITEMS,
        conditions: parseConditions(
          row.conditionsTitle,
          row.conditionsIntro,
          row.conditionsJson,
        ),
      };
    } catch (error) {
      console.error("[site-content] falha ao ler conteúdo do site:", error);
      return {
        google: DEFAULT_GOOGLE_REVIEWS,
        faqItems: FAQ_ITEMS,
        conditions: DEFAULT_VEHICLE_CONDITIONS,
      };
    }
  },
  ["public-site-content-v1"],
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
